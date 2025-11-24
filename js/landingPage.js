// js/landingPage.js
import { getUserProfile } from './session.js';
import { displayError } from './utils.js';

async function initLanding() {
    try {
        const profile = await getUserProfile().catch(err => {
            console.warn('getUserProfile error:', err);
            return null;
        });

        if (profile) {
            const nombreTop = document.getElementById('nombre-top');
            const letraIcon = document.getElementById('letra-icon');

            if (nombreTop) nombreTop.textContent = profile.nombre || profile.nombreSimple;
            if (letraIcon) letraIcon.textContent = profile.primeros || (profile.nombreSimple?.charAt(0)?.toUpperCase()) || 'U';
        }

    } catch (e) {
        console.error('initLanding error', e);
        if (typeof displayError === 'function') displayError('No se pudo cargar información de usuario.');
    }
}

if (window.partialsReady) initLanding();
else document.addEventListener('partialsLoaded', initLanding);
