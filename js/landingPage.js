// js/landingPage.js
import { getUserProfile } from './session.js';
import { notifySuccess, notifyError } from './utils.js';

const BASE_API_URL = 'http://localhost:8081/api';
const CREATE_INVENTORY_ENDPOINT = `${BASE_API_URL}/inventory`;
const GET_SUCURSAL_ENDPOINT = `${BASE_API_URL}/sucursal/getByUsuario`;
const CREATE_TARJETA_ENDPOINT = `${BASE_API_URL}/tarjeta`;

let sucursalModalInstance = null;
let clienteModalInstance = null;
let tarjetaModalInstance = null;

async function fetchSucursalByEmail(email) {
    const token = localStorage.getItem('authToken');

    const res = await fetch(GET_SUCURSAL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
    });

    if (!res.ok) {
        throw new Error('No se pudo obtener la sucursal');
    }

    const data = await res.json();

    return data?.idSucursal ?? null;
}

async function fetchDashboardMetrics() {
    const token = localStorage.getItem('authToken');
    const profile = await getUserProfile();

    const sucursalId = await fetchSucursalByEmail(profile.email);

    let ingresos = 0;
    let gastos = 0;
    let compras = 0;

        if(!sucursalId){
        console.warn('No hay sucursal asignada');
        return { ingresos: 0, gastos: 0, compras: 0 };
    }

    try {
        const ventasResponse = await fetch(`${BASE_API_URL}/sell/total-mes/${sucursalId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (ventasResponse.ok) {
            ingresos = await ventasResponse.json();
        }

        const comprasResponse = await fetch(`${BASE_API_URL}/inventoryDetails/total-mes/${sucursalId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (comprasResponse.ok) {
            compras = await comprasResponse.json();
        }

        const gastosResponse = await fetch(`${BASE_API_URL}/gasto/total/mes/${sucursalId}`,{
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if(gastosResponse.ok){
            gastos = await gastosResponse.json();
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

        const nombreTop = document.getElementById('nombre-top');
        const letraIcon = document.getElementById('letra-icon');

        if (profile) {
            if (nombreTop) nombreTop.textContent = profile.nombreCompleto || profile.nombreSimple;
            if (letraIcon) letraIcon.textContent = profile.primeros || (profile.nombreSimple?.charAt(0)?.toUpperCase()) || 'U';
        } else {
            // Default on error
            if (nombreTop) nombreTop.textContent = 'Usuario';
            if (letraIcon) letraIcon.textContent = 'U';
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

        // payload base para inventario (datos estáticos)
        const payloadInventarioBase = {
            descripcion: 'Inv',
            titulo: 'Inventario 1'
            // NO incluir fechaCreacion aquí; el backend la pone con LocalDate.now()
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

            // Parseamos la respuesta para obtener el id de la sucursal creada
            const sucursalCreated = await res.json();
            console.log('Sucursal creada (raw):', sucursalCreated);

            // Intentamos extraer distintos nombres posibles para el id (priorizamos idSucursal)
            const sucursalId = sucursalCreated?.idSucursal ?? sucursalCreated?.id ?? sucursalCreated?.sucursalId ?? null;

            notifySuccess('Sucursal creada correctamente.');

            // Si obtuvimos id, intentamos crear el inventario ligado
            if (sucursalId) {
                // **IMPORTANTE**: enviar la relación tal como tu backend espera:
                // sucursal: { idSucursal: <id> }
                const payloadInventario = {
                    ...payloadInventarioBase,
                    sucursal: { idSucursal: sucursalId }
                };

                try {
                    const invRes = await fetch(CREATE_INVENTORY_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payloadInventario)
                    });

                    if (!invRes.ok) {
                        // intentar leer body para ver el error exacto del backend
                        let bodyText;
                        try { bodyText = await invRes.text(); } catch (r) { bodyText = `<no body: ${r}>`; }
                        const txt = `Status ${invRes.status} - ${bodyText}`;
                        console.error('Inventario create failed response body:', bodyText);
                        throw new Error(txt);
                    }

                    const inventarioCreated = await invRes.json();
                    console.log('Inventario creado:', inventarioCreated);
                    notifySuccess('Inventario asociado creado correctamente.');
                } catch (invErr) {
                    // Log detallado para debug (revisa la consola / network)
                    console.error('Error creando inventario asociado:', invErr);
                    notifyError(`Sucursal creada pero NO se pudo crear el inventario: ${invErr.message || invErr}`);
                }
            } else {
                console.warn('No se obtuvo id de sucursal en la respuesta; no se creó inventario asociado.');
                notifyError('Sucursal creada pero no fue posible obtener el id para crear el inventario asociado.');
            }

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

function initTarjetaModal() {
    const modalEl = document.getElementById('modalTarjeta');
    if (!modalEl) {
        console.warn('initTarjetaModal: modalTarjeta no encontrado en DOM.');
        return;
    }
    tarjetaModalInstance = new bootstrap.Modal(modalEl);

    const formTarjeta = document.getElementById('formTarjeta');
    if (!formTarjeta) {
        console.warn('initTarjetaModal: formTarjeta no encontrado en DOM.');
        return;
    }

    if (formTarjeta._submitHandler) {
        try { formTarjeta.removeEventListener('submit', formTarjeta._submitHandler); } catch (e) { /* ignore */ }
    }

    const handler = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nombreTarjeta = document.getElementById('inputTarjetaNombre')?.value.trim() || '';
        const numeroTarjeta = document.getElementById('inputTarjetaNumero')?.value.trim() || '';
        const tipoTarjeta = document.getElementById('inputTarjetaTipo')?.value || '';

        if (!nombreTarjeta || nombreTarjeta.length < 3) {
            notifyError('El nombre de la tarjeta debe tener al menos 3 caracteres.');
            return;
        }

        if (!numeroTarjeta || numeroTarjeta.length !== 4 || !/^[0-9]{4}$/.test(numeroTarjeta)) {
            notifyError('Los últimos 4 números deben ser exactamente 4 dígitos numéricos.');
            return;
        }

        if (!tipoTarjeta) {
            notifyError('Debes seleccionar el tipo de tarjeta.');
            return;
        }

        const payload = {
            nombreTarjeta,
            numeroTarjeta,
            tipoTarjeta
        };

        let btn = document.getElementById('btnSubmitTarjeta');

        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Creando...'; }

            const token = localStorage.getItem('authToken');
            const res = await fetch(CREATE_TARJETA_ENDPOINT, {
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

            try { notifySuccess('Tarjeta creada correctamente.'); } catch (e) { console.log('Tarjeta creada correctamente.'); }

            try { formTarjeta.reset(); } catch (err) { console.warn('formTarjeta reset falló:', err); }

            try { if (tarjetaModalInstance && typeof tarjetaModalInstance.hide === 'function') tarjetaModalInstance.hide(); } catch (err) { console.warn('No se pudo ocultar tarjetaModalInstance:', err); }

        } catch (err) {
            console.error('createTarjeta error', err);
            try { notifyError(`No se pudo crear la tarjeta: ${err.message || err}`); } catch (e) { console.error(`No se pudo crear la tarjeta: ${err.message || err}`); }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Crear Tarjeta'; }
        }
    };

    formTarjeta._submitHandler = handler;
    formTarjeta.addEventListener('submit', handler);
}

async function initLanding() {
    await updateDashboardUI();
    initSucursalModal();
    initClienteModal();
    initTarjetaModal();
    resolveSucursalOnLogin();

    setInterval(updateDashboardUI, 30000);
}

if (window.partialsReady) initLanding();
else document.addEventListener('partialsLoaded', initLanding);