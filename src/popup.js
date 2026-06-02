document.addEventListener('DOMContentLoaded', async () => {
    const extensionApi = globalThis.XdebugExtension;
    const radioButtons = document.querySelectorAll('input[name="state"]');
    const optionsLink = document.querySelector('#options');

    document.querySelectorAll('[data-locale]').forEach(e => {
        const message = extensionApi.getMessage(e.dataset.locale);
        const lastNode = e.childNodes[e.childNodes.length - 1];
        if (lastNode.nodeType === Node.TEXT_NODE) {
            lastNode.textContent = message;
        } else if (e.childNodes.length === 0){
            e.innerText = message;
        }
    });

    try {
        const tab = await extensionApi.getActiveTab({ active: true, currentWindow: true });
        if (!tab) {
            return;
        }

        const response = await extensionApi.tabsSendMessage(tab.id, { cmd: "getStatus" });
        if (response?.status === undefined) {
            return
        }

        const radioButton = document.querySelector(`input[name="state"][value="${response.status}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }
    } catch (error) {
        console.log("Error retrieving status:", error);
    }

    optionsLink.addEventListener('click', e => {
        e.preventDefault();
        extensionApi.openOptionsPage().catch((error) => {
            console.log("Error opening options:", error);
        });
    });

    radioButtons.forEach(button => {
        button.addEventListener('change', e => {
            extensionApi.runtimeSendMessage({
                cmd: "setStatus",
                status: +e.target.value
            }).then(() => window.close()).catch((error) => {
                console.log("Error setting status:", error);
            });
        });
    });
});
