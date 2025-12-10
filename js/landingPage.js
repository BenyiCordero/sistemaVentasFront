// js/landingPage.js
import { getUserProfile } from './session.js';
import { notifySuccess, notifyError } from './utils.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

let sucursalModalInstance = null;
let clienteModalInstance = null;

async function fetchDashboardMetrics() {
    const token = localStorage.getItem('authToken');
    const profile = await getUserProfile();

    let ingresos = 0;
    let gastos = 0;
    let compras = 0;
    
    if (!profile?.idSucursal) {
        console.warn('No hay sucursal asignada al usuario');
        return { ingresos: 0, gastos: 0, compras : 0 };
    }

    try {
        const ventasResponse = await fetch(`${BASE_API_URL}/sell/total-mes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (ventasResponse.ok) {
            ingresos = await ventasResponse.json();
        }

        /*
        const gastosResponse = await fetch(`${BASE_API_URL}/sell/total-mes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (gastosResponse.ok) {
            gastos = await ventasResponse.json();
        }
        */

        const comprasResponse = await fetch(`${BASE_API_URL}/inventoryDetails/total-mes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (comprasResponse.ok) {
            compras = await ventasResponse.json();
        }

        return {
            ingresos,
            gastos,
            compras
        };

    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        return { ingresos: 0, gastos: 0, compras: 0 };
    }
}

async function updateDashboardUI() {
    try {
        const profile = await getUserProfile().catch(err => {
            console.warn('getUserProfile error:', err);
            return null;
        });

        if (profile) {
            const nombreTop = document.getElementById('nombre-top');
            const letraIcon = document.getElementById('letra-icon');

            if (nombreTop) nombreTop.textContent = profile.nombreCompleto || profile.nombreSimple;
            if (letraIcon) letraIcon.textContent = profile.primeros || (profile.nombreSimple?.charAt(0)?.toUpperCase()) || 'U';
        }

        const metrics = await fetchDashboardMetrics();
        
        const ingresoTotalEl = document.getElementById('ingreso-total');
        const gastoTotalEl = document.getElementById('gasto-total');
        const comprasTotalEl = document.getElementById('compras-total');
        
        if (ingresoTotalEl) {
            ingresoTotalEl.textContent = `$${Number(metrics.ingresos).toFixed(2)}`;
        }
        
        if (gastoTotalEl) {
            gastoTotalEl.textContent = `$${Number(metrics.gastos).toFixed(2)}`;
        }

        if (comprasTotalEl) {
            comprasTotalEl.textContent = `$${Number(metrics.compras).toFixed(2)}`;
        }

    } catch (e) {
        console.error('initLanding error', e);
        notifyError('No se pudo cargar información del dashboard.');
    }
}

function initSucursalModal() {
    const modalEl = document.getElementById('modalSucursal');
    if (!modalEl) {
        console.warn('initSucursalModal: modalSucursal no encontrado en el DOM.');
        return;
    }

    sucursalModalInstance = new bootstrap.Modal(modalEl);

    const formEl = document.getElementById('formSucursal');
    if (!formEl) {
        console.warn('initSucursalModal: formSucursal no encontrado en el DOM. No se adjuntará submit handler.');
        return;
    }

    if (formEl._sucursalSubmitHandler) {
        try { formEl.removeEventListener('submit', formEl._sucursalSubmitHandler); } catch (e) { /* ignore */ }
    }

    const submitHandler = async function (e) {
        e.preventDefault();
        e.stopPropagation();

        const payload = {
            activo: document.getElementById('inputSucursalActivo')?.checked || false,
            nombre: document.getElementById('inputSucursalNombre')?.value.trim() || '',
            sucursalKey: document.getElementById('inputSucursalKey')?.value.trim() || '',
        };

        console.log('Crear sucursal payload:', payload);

        const btn = document.getElementById('btnSubmitSucursal');
        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Creando...';
            }

            const token = localStorage.getItem('authToken');
            const res = await fetch(`${BASE_API_URL}/sucursal/save`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                let txt = `Status ${res.status}`;
                try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (err) { const t = await res.text(); if (t) txt = t; }
                throw new Error(txt);
            }

            notifySuccess('Sucursal creada correctamente.');

            try { formEl.reset(); } catch (err) { console.warn('form reset falló:', err); }

            if (sucursalModalInstance && typeof sucursalModalInstance.hide === 'function') {
                sucursalModalInstance.hide();
            }

            const updatedProfile = await getUserProfile({ forceRefresh: true });
            if (updatedProfile?.idSucursal) {
                notifySuccess('Sucursal asignada a tu perfil correctamente.');
            }

        } catch (err) {
            console.error('createSucursal error', err);
            notifyError(`No se pudo crear la sucursal: ${err.message || err}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Crear Sucursal';
            }
        }
    };

    formEl._sucursalSubmitHandler = submitHandler;
    formEl.addEventListener('submit', submitHandler);
}

function initClienteModal() {
    const modalEl = document.getElementById('modalCliente');
    if (!modalEl) {
        console.warn('initClienteModal: modalCliente no encontrado en DOM.');
        return;
    }
    clienteModalInstance = new bootstrap.Modal(modalEl);

    const formCliente = document.getElementById('formCliente');
    if (!formCliente) {
        console.warn('initClienteModal: formCliente no encontrado en DOM.');
        return;
    }

    if (formCliente._submitHandler) {
        try { formCliente.removeEventListener('submit', formCliente._submitHandler); } catch (e) { /* ignore */ }
    }

    const handler = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const payload = {
            nombre: document.getElementById('inputClienteNombre')?.value.trim() || '',
            primerApellido: document.getElementById('inputClientePrimerApellido')?.value.trim() || '',
            segundoApellido: document.getElementById('inputClienteSegundoApellido')?.value.trim() || '',
            numeroTelefono: document.getElementById('inputClienteTelefono')?.value.trim() || '',
            creditoActivo: document.getElementById('inputClienteCredito')?.checked || false
        };

        let btn = document.getElementById('btnSubmitCliente');

        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }

            const token = localStorage.getItem('authToken');
            const res = await fetch(`${BASE_API_URL}/client`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                let txt = `Status ${res.status}`;
                try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (err) { const t = await res.text(); if (t) txt = t; }
                throw new Error(txt);
            }

            try { notifySuccess('Cliente creado correctamente.'); } catch (e) { console.log('Cliente creado correctamente.'); }

            try { formCliente.reset(); } catch (err) { console.warn('formCliente reset falló:', err); }

            try { if (clienteModalInstance && typeof clienteModalInstance.hide === 'function') clienteModalInstance.hide(); } catch (err) { console.warn('No se pudo ocultar clienteModalInstance:', err); }

        } catch (err) {
            console.error('createCliente error', err);
            try { notifyError(`No se pudo crear el cliente: ${err.message || err}`); } catch (e) { console.error(`No se pudo crear el cliente: ${err.message || err}`); }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Crear Cliente'; }
        }
    };

    formCliente._submitHandler = handler;
    formCliente.addEventListener('submit', handler);
}


async function initLanding() {
    await updateDashboardUI();
    initSucursalModal();
    initClienteModal();
    
    setInterval(updateDashboardUI, 30000);
}

if (window.partialsReady) initLanding();
else document.addEventListener('partialsLoaded', initLanding);
