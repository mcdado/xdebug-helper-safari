if (!globalThis.XdebugExtension && typeof importScripts === 'function') {
    importScripts('extension-api.js');
}

const DEFAULT_TRIGGER_VALUE = 'YOUR-NAME';
const extensionApi = globalThis.XdebugExtension;

const getSettings = async () => {
    return extensionApi.storageLocalGet({
        xdebugDebugTrigger: DEFAULT_TRIGGER_VALUE,
        xdebugTraceTrigger: DEFAULT_TRIGGER_VALUE,
        xdebugProfileTrigger: DEFAULT_TRIGGER_VALUE
    });
};

const getTab = async () => {
    try {
        return await extensionApi.getActiveTab({ active: true, lastFocusedWindow: true });
    } catch (error) {
        console.log('Error getting active tab:', error);
        return null;
    }
};

const updateIcon = (status, tabId) => {
    return extensionApi.setActionState(status, tabId);
};

extensionApi.onTabsUpdated(async (tabId, changeInfo, tab) => {
    if ((changeInfo?.status || tab?.status) !== 'complete') {
        return;
    }

    try {
        const { xdebugDebugTrigger, xdebugTraceTrigger, xdebugProfileTrigger } = await getSettings();
        const response = await extensionApi.tabsSendMessage(tabId, {
            cmd: 'getStatus',
            debugTrigger: xdebugDebugTrigger,
            traceTrigger: xdebugTraceTrigger,
            profileTrigger: xdebugProfileTrigger
        });

        updateIcon(response?.status, tabId);
    } catch (error) {
        console.log('Error during tab update:', error);
    }
});

extensionApi.onCommand(async (command) => {
    try {
        const tab = await getTab();
        if (!tab) {
            return;
        }

        const settings = await getSettings();
        const response = await extensionApi.tabsSendMessage(tab.id, {
            cmd: 'getStatus',
            debugTrigger: settings.xdebugDebugTrigger,
            traceTrigger: settings.xdebugTraceTrigger,
            profileTrigger: settings.xdebugProfileTrigger
        });

        let newState;

        switch (command) {
            case 'run-toggle-debug':
                newState = response?.status === 1 ? 0 : 1; // Toggle debug (1 <-> 0)
                break;
            case 'run-toggle-profile':
                newState = response?.status === 2 ? 0 : 2; // Toggle profile (2 <-> 0)
                break;
            case 'run-toggle-trace':
                newState = response?.status === 3 ? 0 : 3; // Toggle trace (3 <-> 0)
                break;
            default:
                return; // Ignore unknown commands
        }

        const setResponse = await extensionApi.tabsSendMessage(tab.id, {
            cmd: 'setStatus',
            status: newState,
            debugTrigger: settings.xdebugDebugTrigger,
            traceTrigger: settings.xdebugTraceTrigger,
            profileTrigger: settings.xdebugProfileTrigger
        });
        updateIcon(setResponse?.status, tab.id);
    } catch (error) {
        console.log('Error during command execution:', error);
    }
});

const setActiveTabStatus = async (status) => {
    const settings = await getSettings();
    const tab = await getTab();
    if (!tab) {
        return { status };
    }

    const response = await extensionApi.tabsSendMessage(tab.id, {
        cmd: 'setStatus',
        status,
        debugTrigger: settings.xdebugDebugTrigger,
        traceTrigger: settings.xdebugTraceTrigger,
        profileTrigger: settings.xdebugProfileTrigger
    });

    updateIcon(response?.status, tab.id);
    return { status: response?.status ?? status };
};

extensionApi.onRuntimeMessage((request) => {
    if (request.cmd !== 'setStatus') {
        return undefined;
    }

    return setActiveTabStatus(request.status).catch((error) => {
        console.log('Error during setStatus:', error);
        return { status: request.status };
    });
});

extensionApi.onInstalled((details) => {
    if (details.reason === 'install') {
        extensionApi.setUninstallURL('https://forms.gle/XmCBqknF5BZJQhHX6');
        extensionApi.commandsGetAll().then((commands) => {
            let missingShortcuts = [];
            for (let { name, shortcut } of commands) {
                if (shortcut === '') {
                    missingShortcuts.push(name);
                }
            }

            if (missingShortcuts.length > 0) {
                console.log('Missing shortcuts:', missingShortcuts);
            }
        }).catch((error) => {
            console.log('Error getting commands:', error);
        });
    }
});

