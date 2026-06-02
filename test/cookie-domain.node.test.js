const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const contentSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'content.js'), 'utf8');

/**
 * Creates a small document.cookie mock that accepts cookie writes.
 *
 * @returns {{ document: { cookie: string }, writes: string[] }} Mock document and write log.
 */
function createCookieDocument() {
    const cookies = new Map();
    const writes = [];

    const document = {};
    Object.defineProperty(document, 'cookie', {
        get() {
            return Array.from(cookies.entries())
                .map(([name, value]) => `${name}=${value}`)
                .join('; ');
        },
        set(cookie) {
            writes.push(cookie);
            const [pair, ...attributes] = cookie.split(';');
            const [name, value] = pair.split('=');
            const isExpired = attributes.some((attribute) => /expires=thu, 01 jan 1970/i.test(attribute.trim()));

            if (isExpired) {
                cookies.delete(name);
                return;
            }

            cookies.set(name, value);
        },
    });

    return { document, writes };
}

/**
 * Loads the content script for a specific hostname.
 *
 * @param {string} hostname Window location hostname.
 * @returns {{ api: Record<string, Function>, writes: string[] }} Loaded content API and cookie writes.
 */
function loadContent(hostname) {
    const { document, writes } = createCookieDocument();
    const context = vm.createContext({
        console,
        Date,
        Math,
        document,
        window: {
            location: { hostname },
        },
        XdebugExtension: {
            storageLocalGet: async (defaults) => defaults,
            onRuntimeMessage: () => {},
        },
    });

    vm.runInContext(contentSource, context);
    return { api: context.XdebugContent, writes };
}

test('uses host-only cookies for localhost, IP addresses, and single-label hosts', () => {
    for (const hostname of ['localhost', '127.0.0.1', 'intranet', '::1']) {
        const { api } = loadContent(hostname);

        assert.equal(api.requiresHostOnlyCookie(hostname), true);
        assert.equal(api.getDomainForCookie(), null);
    }
});

test('selects the registrable domain for normal hostnames', () => {
    assert.equal(loadContent('example.com').api.getDomainForCookie(), 'example.com');
    assert.equal(loadContent('foo.example.com').api.getDomainForCookie(), 'example.com');
    assert.equal(loadContent('test.localhost').api.getDomainForCookie(), 'test.localhost');
});

test('setCookie omits the domain attribute when host-only cookies are required', () => {
    const { api, writes } = loadContent('localhost');

    api.setCookie('XDEBUG_SESSION', 'YOUR-NAME');

    assert.equal(writes.length, 1);
    assert.match(writes[0], /^XDEBUG_SESSION=YOUR-NAME;/);
    assert.doesNotMatch(writes[0], /;domain=/);
});
