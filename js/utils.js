// utils.js

/**
 * Toast global - esquina superior derecha.
 * Uso: showToast('Texto', 'success'|'error'|'info')
 */
export function showToast(text, type = 'info') {
    let container = document.getElementById('toast-container-topright');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container-topright';
        Object.assign(container.style, {
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 12000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'flex-end',
            pointerEvents: 'none'
        });
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `simple-toast toast-${type}`;
    toast.textContent = text;
    Object.assign(toast.style, {
        minWidth: '200px',
        maxWidth: '360px',
        padding: '10px 14px',
        borderRadius: '8px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.1)',
        background: type === 'success' ? '#e6ffed' : (type === 'error' ? '#ffecec' : '#f0f7ff'),
        color: '#111',
        pointerEvents: 'auto',
        fontSize: '14px',
        opacity: '0',
        transform: 'translateY(-6px)',
        transition: 'opacity .18s ease, transform .18s ease'
    });

    container.appendChild(toast);

    // show
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // auto hide after 3s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-6px)';
        setTimeout(() => {
            if (toast && toast.parentNode) toast.parentNode.removeChild(toast);
            if (container && container.childElementCount === 0) {
                container.parentNode && container.parentNode.removeChild(container);
            }
        }, 220);
    }, 3000);
}

export function notifySuccess(msg) { showToast(msg, 'success'); }
export function notifyError(msg) { showToast(msg, 'error'); }

/**
 * displayMessage / displayError: backward-compatible helpers.
 * Firma antigua: displayMessage(element, message, type)
 * Nueva firma permitida: displayMessage(message, type) -> usará showToast
 */
export function displayMessage(elementOrMessage, messageOrType, maybeType = 'info') {
    // Caso 1: llamada tradicional displayMessage(element, message, type)
    if (typeof elementOrMessage !== 'string' && elementOrMessage instanceof Element) {
        const el = elementOrMessage;
        const message = messageOrType || '';
        const type = maybeType || 'info';
        el.textContent = message;
        el.classList.add('info-message', type);
        el.classList.remove('hidden');
        return;
    }

    // Caso 2: llamada moderna displayMessage(message, type) -> usar toast
    const message = elementOrMessage || '';
    const type = messageOrType || 'info';
    showToast(message, type);
}

export function clearMessage(element) {
    element.textContent = '';
    element.classList.add('info-message');
}

/**
 * displayError(element, message) o displayError(message)
 */
export function displayError(elementOrMessage, maybeMessage) {
    if (typeof elementOrMessage !== 'string' && elementOrMessage instanceof Element) {
        const el = elementOrMessage;
        const message = maybeMessage || '';
        el.textContent = message;
        el.classList.add('error-message');
        el.classList.remove('hidden');
        return;
    }

    // si sólo pasaron un string -> usar toast de error
    const message = elementOrMessage || maybeMessage || '';
    showToast(message, 'error');
}

export function clearError(element) {
    element.textContent = '';
    element.classList.remove('error-message');
}

export function hideElement(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

export function showElement(element) {
    if (element) {
        element.classList.remove('hidden');
    }
}

/**
 * showConfirmation se mantiene igual (si lo usas)
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
            try { bsModal.hide(); } catch (e) { }
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