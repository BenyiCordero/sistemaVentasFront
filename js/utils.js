/**
 * Muestra un mensaje temporal al usuario.
 * @param {HTMLElement} element 
 * @param {string} message 
 * @param {string} type 
 */
export function displayMessage(element, message, type = 'info') {
    element.textContent = message;
    element.classList.add('info-message', type); 
    element.classList.remove('hidden'); 
}

/**
 * Limpia el mensaje de un elemento.
 * @param {HTMLElement} element - El elemento DOM cuyo mensaje se limpiará.
 */
export function clearMessage(element) {
    element.textContent = '';
    element.classList.add('info-message'); 
}

/**
 * Muestra un mensaje de error temporal al usuario.
 * @param {HTMLElement} element 
 * @param {string} message 
 */
export function displayError(element, message) {
    element.textContent = message;
    element.classList.add('error-message'); 
    element.classList.remove('hidden');
}

/**
 * Limpia el mensaje de error de un elemento.
 * @param {HTMLElement} element 
 */
export function clearError(element) {
    element.textContent = '';
    element.classList.remove('error-message'); 
}

/**
 * Oculta un elemento añadiendo la clase 'hidden'.
 * @param {HTMLElement} element 
 */
export function hideElement(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

/**
 * Muestra un elemento removiendo la clase 'hidden'.
 * @param {HTMLElement} element 
 */
export function showElement(element) {
    if (element) {
        element.classList.remove('hidden');
    }
}


/**
 * Muestra un cuadro de diálogo de confirmación usando el modal de Bootstrap.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function showConfirmation(message) {
    return new Promise((resolve) => {
        const modalEl = document.getElementById('confirmationModal');
        const messageEl = document.getElementById('confirmationMessage');
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');

        if (!modalEl || !messageEl || !yesBtn || !noBtn) {
            console.error('Modal de confirmación o elementos del modal no encontrados.');
            resolve(false);
            return;
        }

        messageEl.textContent = message;

        const bsModal = new bootstrap.Modal(modalEl, {
            backdrop: 'static', 
            keyboard: false  
        });

        const onYes = () => {
            cleanup();
            resolve(true);
        };

        const onNo = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
            try { bsModal.hide(); } catch (e) {  }
        };

        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);

        const onHidden = () => {
            cleanup();
            resolve(false);
            modalEl.removeEventListener('hidden.bs.modal', onHidden);
        };
        modalEl.addEventListener('hidden.bs.modal', onHidden);

        bsModal.show();
    });
}