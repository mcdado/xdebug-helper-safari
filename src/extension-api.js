(function initXdebugExtensionApi(globalScope) {
    'use strict';

    const hasBrowserNamespace = typeof globalScope.browser !== 'undefined' && Boolean(globalScope.browser?.runtime);
    const rawApi = hasBrowserNamespace ? globalScope.browser : globalScope.chrome;
    const usesPromiseApi = hasBrowserNamespace;

    const ACTION_STATES = Object.freeze({
        0: { title: 'Disabled', image: 'img/disable32.png' },
        1: { title: 'Debugging', image: 'img/debug32.png' },
        2: { title: 'Profiling', image: 'img/profile32.png' },
        3: { title: 'Tracing', image: 'img/trace32.png' },
    });

    /**
     * Converts a browser runtime error object into an Error instance.
     *
     * @param {unknown} error Browser runtime error value.
     * @returns {Error} Normalized error.
     */
    const toError = (error) => {
        if (error instanceof Error) {
            return error;
        }

        if (error && typeof error === 'object' && 'message' in error) {
            return new Error(String(error.message));
        }

        return new Error(String(error));
    };

    /**
     * Reads the callback-style lastError value when using the chrome namespace.
     *
     * @returns {unknown} Runtime lastError, if present.
     */
    const getLastError = () => rawApi?.runtime?.lastError;

    /**
     * Calls an extension API method and normalizes browser promise APIs and chrome callback APIs.
     *
     * @param {Record<string, Function> | undefined} target API object containing the method.
     * @param {string} methodName Method to call.
     * @param {unknown[]} args Arguments to pass.
     * @returns {Promise<unknown>} Promise for the API result.
     */
    const callApi = (target, methodName, args = []) => {
        if (!target || typeof target[methodName] !== 'function') {
            return Promise.reject(new Error(`Extension API method unavailable: ${methodName}`));
        }

        if (usesPromiseApi) {
            try {
                return Promise.resolve(target[methodName](...args));
            } catch (error) {
                return Promise.reject(error);
            }
        }

        return new Promise((resolve, reject) => {
            try {
                target[methodName](...args, (result) => {
                    const lastError = getLastError();
                    if (lastError) {
                        reject(toError(lastError));
                        return;
                    }

                    resolve(result);
                });
            } catch (error) {
                reject(error);
            }
        });
    };

    /**
     * Calls an optional API method, resolving to a fallback when unavailable.
     *
     * @param {Record<string, Function> | undefined} target API object containing the method.
     * @param {string} methodName Method to call.
     * @param {unknown[]} args Arguments to pass.
     * @param {unknown} fallback Value to resolve when the method does not exist.
     * @returns {Promise<unknown>} Promise for the API result or fallback.
     */
    const callOptionalApi = (target, methodName, args = [], fallback = undefined) => {
        if (!target || typeof target[methodName] !== 'function') {
            return Promise.resolve(fallback);
        }

        return callApi(target, methodName, args);
    };

    /**
     * Adds an extension event listener if the event is available.
     *
     * @param {{ addListener?: Function } | undefined} event Extension event.
     * @param {Function} listener Listener callback.
     */
    const addListener = (event, listener) => {
        if (event && typeof event.addListener === 'function') {
            event.addListener(listener);
        }
    };

    /**
     * Builds API details that optionally include a tab id.
     *
     * @param {number | undefined} tabId Target tab id.
     * @param {Record<string, unknown>} details Base details object.
     * @returns {Record<string, unknown>} Details object for action/pageAction APIs.
     */
    const withOptionalTabId = (tabId, details) => {
        if (tabId === undefined || tabId === null) {
            return details;
        }

        return { tabId, ...details };
    };

    /**
     * Gets localized extension text.
     *
     * @param {string} key i18n message key.
     * @returns {string} Localized message or an empty string.
     */
    const getMessage = (key) => {
        if (!rawApi?.i18n || typeof rawApi.i18n.getMessage !== 'function') {
            return '';
        }

        return rawApi.i18n.getMessage(key) || '';
    };

    /**
     * Registers a runtime message listener that can return a value or promise.
     *
     * @param {(message: unknown, sender: unknown) => unknown | Promise<unknown>} handler Message handler.
     */
    const onRuntimeMessage = (handler) => {
        addListener(rawApi?.runtime?.onMessage, (message, sender, sendResponse) => {
            let result;
            try {
                result = handler(message, sender);
            } catch (error) {
                console.log('Error handling runtime message:', error);
                sendResponse({ error: toError(error).message });
                return false;
            }

            if (result === undefined) {
                return false;
            }

            Promise.resolve(result)
                .then((response) => {
                    if (response !== undefined) {
                        sendResponse(response);
                    }
                })
                .catch((error) => {
                    console.log('Error resolving runtime message:', error);
                    sendResponse({ error: toError(error).message });
                });

            return true;
        });
    };

    /**
     * Updates the toolbar title and icon for the current Xdebug state.
     *
     * @param {number | undefined} status Xdebug state id.
     * @param {number | undefined} tabId Optional target tab id.
     * @returns {Promise<void>} Resolves once available toolbar APIs have been called.
     */
    const setActionState = async (status, tabId) => {
        const toolbar = rawApi?.action || rawApi?.browserAction || rawApi?.pageAction;
        if (!toolbar) {
            return;
        }

        const actionInfo = ACTION_STATES[Number(status)] || ACTION_STATES[0];
        const updates = [
            callOptionalApi(toolbar, 'setTitle', [withOptionalTabId(tabId, { title: actionInfo.title })]),
            callOptionalApi(toolbar, 'setIcon', [withOptionalTabId(tabId, { path: actionInfo.image })]),
        ];

        if (tabId !== undefined && tabId !== null) {
            updates.push(callOptionalApi(toolbar, 'show', [tabId]));
        }

        try {
            await Promise.all(updates);
        } catch (error) {
            console.log('Error updating extension action:', error);
        }
    };

    /**
     * Queries tabs and returns the first matching active tab.
     *
     * @param {Record<string, unknown>} query Tab query options.
     * @returns {Promise<unknown | null>} Matching tab or null.
     */
    const getActiveTab = async (query = { active: true, lastFocusedWindow: true }) => {
        const tabs = await callApi(rawApi?.tabs, 'query', [query]);
        return Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
    };

    globalScope.XdebugExtension = {
        namespace: usesPromiseApi ? 'browser' : 'chrome',
        raw: rawApi,
        storageLocalGet: (defaults) => callApi(rawApi?.storage?.local, 'get', [defaults]),
        storageLocalSet: (items) => callApi(rawApi?.storage?.local, 'set', [items]),
        tabsQuery: (query) => callApi(rawApi?.tabs, 'query', [query]),
        tabsSendMessage: (tabId, message) => callApi(rawApi?.tabs, 'sendMessage', [tabId, message]),
        runtimeSendMessage: (message) => callApi(rawApi?.runtime, 'sendMessage', [message]),
        openOptionsPage: () => callApi(rawApi?.runtime, 'openOptionsPage'),
        setUninstallURL: (url) => callOptionalApi(rawApi?.runtime, 'setUninstallURL', [url]),
        commandsGetAll: () => callOptionalApi(rawApi?.commands, 'getAll', [], []),
        getActiveTab,
        getMessage,
        onRuntimeMessage,
        onTabsUpdated: (listener) => addListener(rawApi?.tabs?.onUpdated, listener),
        onCommand: (listener) => addListener(rawApi?.commands?.onCommand, listener),
        onInstalled: (listener) => addListener(rawApi?.runtime?.onInstalled, listener),
        setActionState,
    };
})(globalThis);
