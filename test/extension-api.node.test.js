const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const helperSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension-api.js'), 'utf8');

/**
 * Converts VM-created values to regular Node values for strict comparisons.
 *
 * @param {unknown} value Value from a VM context.
 * @returns {unknown} Plain JSON-compatible value.
 */
function toPlainValue(value) {
    return JSON.parse(JSON.stringify(value));
}

/**
 * Loads the extension API helper in an isolated VM context.
 *
 * @param {Record<string, unknown>} globals Mock globals.
 * @returns {Record<string, unknown>} VM context.
 */
function loadHelper(globals) {
    const context = vm.createContext({ console, ...globals });
    vm.runInContext(helperSource, context);
    return context;
}

test('normalizes browser namespace promise APIs', async () => {
    const calls = [];
    let runtimeListener;

    const context = loadHelper({
        browser: {
            storage: {
                local: {
                    get: async (defaults) => ({ ...defaults, source: 'browser' }),
                    set: async (items) => ({ saved: items }),
                },
            },
            tabs: {
                query: async (query) => [{ id: 12, query }],
                sendMessage: async (tabId, message) => ({ tabId, message }),
                onUpdated: { addListener: () => {} },
            },
            runtime: {
                sendMessage: async (message) => ({ message }),
                openOptionsPage: async () => 'opened',
                setUninstallURL: async (url) => ({ url }),
                onMessage: { addListener: (listener) => { runtimeListener = listener; } },
                onInstalled: { addListener: () => {} },
            },
            commands: {
                getAll: async () => [{ name: 'run-toggle-debug', shortcut: 'Alt+C' }],
                onCommand: { addListener: () => {} },
            },
            i18n: {
                getMessage: (key) => `message:${key}`,
            },
            action: {
                setTitle: async (details) => calls.push(['setTitle', details]),
                setIcon: async (details) => calls.push(['setIcon', details]),
            },
        },
    });

    const api = context.XdebugExtension;

    assert.equal(api.namespace, 'browser');
    assert.deepEqual(await api.storageLocalGet({ xdebugDebugTrigger: 'YOUR-NAME' }), {
        xdebugDebugTrigger: 'YOUR-NAME',
        source: 'browser',
    });
    assert.deepEqual(await api.getActiveTab({ active: true }), { id: 12, query: { active: true } });
    assert.deepEqual(await api.tabsSendMessage(12, { cmd: 'getStatus' }), {
        tabId: 12,
        message: { cmd: 'getStatus' },
    });
    assert.deepEqual(await api.commandsGetAll(), [{ name: 'run-toggle-debug', shortcut: 'Alt+C' }]);
    assert.equal(api.getMessage('popup_debug'), 'message:popup_debug');

    api.onRuntimeMessage((message) => Promise.resolve({ ok: message.ok }));
    const responses = [];
    const keptOpen = runtimeListener({ ok: true }, {}, (response) => responses.push(response));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(keptOpen, true);
    assert.deepEqual(responses, [{ ok: true }]);

    await api.setActionState(99, 12);
    assert.deepEqual(toPlainValue(calls), [
        ['setTitle', { tabId: 12, title: 'Disabled' }],
        ['setIcon', { tabId: 12, path: 'img/disable32.png' }],
    ]);
});

test('normalizes chrome namespace callback APIs', async () => {
    const calls = [];
    let runtimeListener;

    const context = loadHelper({
        chrome: {
            storage: {
                local: {
                    get: (defaults, callback) => callback({ ...defaults, source: 'chrome' }),
                    set: (items, callback) => callback({ saved: items }),
                },
            },
            tabs: {
                query: (query, callback) => callback([{ id: 7, query }]),
                sendMessage: (tabId, message, callback) => callback({ tabId, message }),
                onUpdated: { addListener: () => {} },
            },
            runtime: {
                lastError: null,
                sendMessage: (message, callback) => callback({ message }),
                openOptionsPage: (callback) => callback('opened'),
                setUninstallURL: (url, callback) => callback({ url }),
                onMessage: { addListener: (listener) => { runtimeListener = listener; } },
                onInstalled: { addListener: () => {} },
            },
            commands: {
                getAll: (callback) => callback([{ name: '_execute_action', shortcut: 'Alt+X' }]),
                onCommand: { addListener: () => {} },
            },
            i18n: {
                getMessage: (key) => `message:${key}`,
            },
            action: {
                setTitle: (details, callback) => {
                    calls.push(['setTitle', details]);
                    callback();
                },
                setIcon: (details, callback) => {
                    calls.push(['setIcon', details]);
                    callback();
                },
            },
        },
    });

    const api = context.XdebugExtension;

    assert.equal(api.namespace, 'chrome');
    assert.deepEqual(await api.storageLocalGet({ xdebugDebugTrigger: 'YOUR-NAME' }), {
        xdebugDebugTrigger: 'YOUR-NAME',
        source: 'chrome',
    });
    assert.deepEqual(await api.getActiveTab({ active: true }), { id: 7, query: { active: true } });
    assert.deepEqual(await api.tabsSendMessage(7, { cmd: 'getStatus' }), {
        tabId: 7,
        message: { cmd: 'getStatus' },
    });
    assert.deepEqual(await api.commandsGetAll(), [{ name: '_execute_action', shortcut: 'Alt+X' }]);

    api.onRuntimeMessage(() => undefined);
    const keptOpen = runtimeListener({ ok: true }, {}, () => {});
    assert.equal(keptOpen, false);

    await api.setActionState(1, 7);
    assert.deepEqual(toPlainValue(calls), [
        ['setTitle', { tabId: 7, title: 'Debugging' }],
        ['setIcon', { tabId: 7, path: 'img/debug32.png' }],
    ]);
});
