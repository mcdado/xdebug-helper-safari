const DEFAULT_TRIGGER_VALUE = 'YOUR-NAME';
const extensionApi = globalThis.XdebugExtension;

const getCookie = (name) => {
    const cookie = document.cookie.split(';').find((c) => c.trim().startsWith(`${name}=`));
    if (!cookie) {
        return null;
    }

    return decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
};

const setCookie = (name, value, days = 365) => {
    const domain = getDomainForCookie();
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    const encodedValue = value === null ? '' : encodeURIComponent(value);
    let cookie = `${name}=${encodedValue};expires=${expires};path=/`;
    if (domain) {
        cookie += `;domain=${domain}`;
    }
    document.cookie = cookie;
};

const requiresHostOnlyCookie = (hostname) => {
    const normalizedHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase();

    return normalizedHostname === ''
        || normalizedHostname === 'localhost'
        || !normalizedHostname.includes('.')
        || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(normalizedHostname)
        || normalizedHostname.includes(':');
};

const getDomainForCookie = () => {
    const hostname = window.location.hostname;

    if (requiresHostOnlyCookie(hostname)) {
        return null;
    }

    const parts = hostname.split('.');

    // Start from the TLD-ish part (e.g. 'com' or 'localhost') and work up.
    // The probe logic will ensure we only use domains that the browser actually accepts.
    for (let i = parts.length - 1; i >= 0; i--) {
        const domain = parts.slice(i).join('.');

        if (parts.length > 1 && i === parts.length - 1) {
            continue;
        }

        const value = Math.random().toString(36).substring(2);
        const name = `_xd_${value}`;
        document.cookie = `${name}=${value};domain=${domain};path=/`;

        if (document.cookie.includes(`${name}=${value}`)) {
            document.cookie = `${name}=;domain=${domain};path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            return domain;
        }
    }

    return null;
};

const getStatusMap = (settings) => {
    const { xdebugDebugTrigger, xdebugTraceTrigger, xdebugProfileTrigger } = settings;
    return {
        1: { name: 'XDEBUG_SESSION', trigger: xdebugDebugTrigger },
        2: { name: 'XDEBUG_PROFILE', trigger: xdebugProfileTrigger },
        3: { name: 'XDEBUG_TRACE', trigger: xdebugTraceTrigger },
    };
};

const getCurrentStatus = () => {
    return extensionApi.storageLocalGet({
        xdebugDebugTrigger: DEFAULT_TRIGGER_VALUE,
        xdebugTraceTrigger: DEFAULT_TRIGGER_VALUE,
        xdebugProfileTrigger: DEFAULT_TRIGGER_VALUE
    }).then((settings) => {
        const statusMap = getStatusMap(settings);
        for (const [idx, { name, trigger }] of Object.entries(statusMap)) {
            if (getCookie(name) === trigger) {
                return +idx;
            }
        }

        return 0;
    });
};

const setStatus = status => {
    return extensionApi.storageLocalGet({
        xdebugDebugTrigger: DEFAULT_TRIGGER_VALUE,
        xdebugTraceTrigger: DEFAULT_TRIGGER_VALUE,
        xdebugProfileTrigger: DEFAULT_TRIGGER_VALUE
    }).then((settings) => {
        const statusMap = getStatusMap(settings);
        for (const { name } of Object.values(statusMap)) {
            setCookie(name, null, -1); // Delete existing cookies
        }

        if (status > 0 && statusMap[status]) {
            const { name, trigger } = statusMap[status];
            setCookie(name, trigger);
        }

        return undefined;
    });
};

// Listens for messages from the background script
extensionApi.onRuntimeMessage((msg) => {
    switch (msg.cmd) {
        case 'getStatus':
            return getCurrentStatus().then(status => ({ status }));
        case 'setStatus':
            return setStatus(msg.status).then(() => ({ status: msg.status }));
        case 'getDomain':
            return { domain: getDomainForCookie() };
        default:
            return { status: 0 };
    }
});

globalThis.XdebugContent = {
    getCookie,
    setCookie,
    getDomainForCookie,
    requiresHostOnlyCookie,
};
