// js/landingPage.js
import { getUserProfile } from './session.js';
import { notifySuccess, notifyError } from './utils.js';

const BASE_API_URL = 'http://127.0.0.1:8081';
const CREATE_INVENTORY_ENDPOINT = `${BASE_API_URL}/inventory`;
const GET_SUCURSAL_ENDPOINT = `${BASE_API_URL}/sucursal/getByUsuario`;

let sucursalModalInstance = null;
let clienteModalInstance = null;

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

    return res.json();
}

async function resolveSucursalOnLogin() {
    const profile = await getUserProfile().catch(() => null);
    if (!profile) return null;

    if (profile.idSucursal) {
        localStorage.setItem('sucursalId', profile.idSucursal);
        return profile.idSucursal;
    }

    if (profile.email) {
        try {
            const sucursal = await fetchSucursalByEmail(profile.email);
            if (sucursal?.idSucursal) {
                localStorage.setItem('sucursalId', sucursal.idSucursal);
                return sucursal.idSucursal;
            }
        } catch (e) {
            console.warn('No se pudo resolver sucursal en login', e);
        }
    }

    localStorage.removeItem('sucursalId');
    return null;
}


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

        const comprasResponse = await fetch(`${BASE_API_URL}/inventoryDetails/total-mes`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (comprasResponse.ok) {
            compras = await comprasResponse.json();
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

async function initLanding() {
    await updateDashboardUI();
    initSucursalModal();
    initClienteModal();
    resolveSucursalOnLogin();
    
    setInterval(updateDashboardUI, 30000);
}

if (window.partialsReady) initLanding();
else document.addEventListener('partialsLoaded', initLanding);