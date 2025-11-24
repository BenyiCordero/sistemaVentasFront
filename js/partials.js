import { getUserProfile, clearUserProfile } from './session.js';

async function loadPartial(url) {
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`No se pudo cargar ${url}: ${res.status}`);
        return await res.text();
    } catch (err) {
        console.error(err);
        return `<div class="text-danger">Error cargando plantilla: ${url}</div>`;
    }
}

async function initPartials() {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const topbarPlaceholder = document.getElementById('topbar-placeholder');

    const [sidebarHtml, topbarHtml] = await Promise.all([
        loadPartial('/partials/sidebar.html'),
        loadPartial('/partials/topbar.html'),
    ]);

    if (sidebarPlaceholder) sidebarPlaceholder.innerHTML = sidebarHtml;
    if (topbarPlaceholder) topbarPlaceholder.innerHTML = topbarHtml;

    setupCommonBehavior();

    try{
        const profile = await getUserProfile().catch(err => {
            console.warn("No se pudo obtener el perfil");
            return null;
        });

        if(profile){
            const nombreTop = document.getElementById('nombre-top');
            const letraIcon = document.getElementById('letra-icon');
            if (nombreTop) nombreTop.textContent = profile.nombre || profile.nombreSimple || 'Usuario';
            if (letraIcon) letraIcon.textContent = profile.primeros || (profile.nombreSimple?.charAt(0)?.toUpperCase()) || 'U';
        }
    } catch(e){
        console.error("Error rellenando topaBar");
    }

    document.dispatchEvent(new CustomEvent('partialsLoaded'));
}

function setupCommonBehavior() {
    const toggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open-mobile'); 
        });
    }

    const footerYear = document.getElementById('footer-year');
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    const hoy = document.getElementById('today');
    if (hoy) {
        const d = new Date();
        const opt = { year: 'numeric', month: 'short', day: 'numeric' };
        hoy.textContent = d.toLocaleDateString('es-MX', opt);
    }

    try {
        const current = document.body.getAttribute('data-page'); 
        if (current) {
            const link = document.querySelector(`#sidebar [data-page="${current}"]`);
            if (link) link.classList.add('active');
        }
    } catch (e) { /* no pasa nada */ }

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('authToken');
            clearUserProfile();
            window.location.href = 'login.html';
        });
    }
}

document.addEventListener('DOMContentLoaded', initPartials);