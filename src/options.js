document.addEventListener('DOMContentLoaded', () => {
    const extensionApi = globalThis.XdebugExtension;
    const optionsForm = document.querySelector('form');
    const debugTriggerInput = document.getElementById('debugtrigger');
    const traceTriggerInput = document.getElementById('tracetrigger');
    const profileTriggerInput = document.getElementById('profiletrigger');
    const helpDiv = document.getElementById('help');

    document.querySelectorAll('[data-locale]').forEach(e => {
        e.innerText = extensionApi.getMessage(e.dataset.locale)
    });

    document.querySelector('button[type="reset"]').addEventListener('click', e => {
        e.preventDefault();
        debugTriggerInput.value = '';
        traceTriggerInput.value = '';
        profileTriggerInput.value = '';
    });

    document.querySelector('button[type="submit"]').addEventListener('click', async e => {
        e.preventDefault();
        try {
            await extensionApi.storageLocalSet({
                xdebugDebugTrigger: debugTriggerInput.value,
                xdebugTraceTrigger: traceTriggerInput.value,
                xdebugProfileTrigger: profileTriggerInput.value
            });
            optionsForm.classList.add('success');
            setTimeout(() => optionsForm.classList.remove('success'), 1500);
        } catch (error) {
            console.log('Error saving options:', error);
        }
    });

    extensionApi.storageLocalGet({
        xdebugDebugTrigger: 'YOUR-NAME',
        xdebugTraceTrigger: null,
        xdebugProfileTrigger: null,
    }).then((settings) => {
        debugTriggerInput.value = settings.xdebugDebugTrigger;
        traceTriggerInput.value = settings.xdebugTraceTrigger;
        profileTriggerInput.value = settings.xdebugProfileTrigger;
    }).catch((error) => {
        console.log('Error loading options:', error);
    });

    extensionApi.commandsGetAll().then((commands) => {
        helpDiv.querySelectorAll('p').forEach(p => p.remove());

        if (commands.length === 0) {
            const newP = document.createElement('p');
            newP.appendChild(document.createTextNode('No shortcuts defined'));
            helpDiv.appendChild(newP);
            return;
        }

        for (const { name, shortcut , description } of commands) {    
            if (!shortcut) {
                break;
            }
            const parts = shortcut.split('+');
            const newP = document.createElement('p');
            parts.forEach((part, index) => {
                const newKbd = document.createElement('kbd');
                newKbd.textContent = part;
                newP.appendChild(newKbd);
                if (index < parts.length - 1) {
                    newP.appendChild(document.createTextNode(' + '));
                }
            });

            newP.appendChild(document.createTextNode(' ' + (description || extensionApi.getMessage("options_execute_action"))));
            helpDiv.appendChild(newP);
        }
    }).catch((error) => {
        console.log('Error loading commands:', error);
    });
});
