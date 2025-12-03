// js/landingPage.js
import { getUserProfile } from './session.js';
import { displayError, displayMessage } from './utils.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

let sucursalModalInstance = null;
let clienteModalInstance = null;

async function fetchDashboardMetrics() {
    const token = localStorage.getItem('authToken');
    const profile = await getUserProfile();
    
    if (!profile?.idSucursal) {
        console.warn('No hay sucursal asignada al usuario');
        return { ingresos: 0, gastos: 0, totalVentas: 0, totalCreditos: 0 };
    }

    try {
        const ventasResponse = await fetch(`${BASE_API_URL}/sell/sucursal/${profile.idSucursal}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        let ingresos = 0;
        let totalVentas = 0;
        
        if (ventasResponse.ok) {
            const ventasData = await ventasResponse.json();
            const ventas = Array.isArray(ventasData) ? ventasData : (ventasData?.ventas ?? ventasData?.data ?? []);
            
            // Calcular ingresos del mes actual
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            
            ventas.forEach(venta => {
                const ventaDate = new Date(venta.fecha);
                if (ventaDate.getMonth() === currentMonth && ventaDate.getFullYear() === currentYear) {
                    ingresos += venta.totalVenta || venta.total || 0;
                }
            });
            
            totalVentas = ventas.length;
        }

        const gastos = JSON.parse(localStorage.getItem('expenses') || '[]');
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        let gastosMes = 0;
        gastos.forEach(gasto => {
            const gastoDate = new Date(gasto.fecha);
            if (gastoDate.getMonth() === currentMonth && gastoDate.getFullYear() === currentYear) {
                gastosMes += gasto.monto || 0;
            }
        });

        // Obtener créditos
        let totalCreditos = 0;
        try {
            const creditosResponse = await fetch(`${BASE_API_URL}/api/v1/creditos`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (creditosResponse.ok) {
                const creditosData = await creditosResponse.json();
                const creditos = Array.isArray(creditosData) ? creditosData : (creditosData?.creditos ?? creditosData?.data ?? []);
                totalCreditos = creditos.length;
            }
        } catch (e) {
            console.warn('Error obteniendo créditos:', e);
        }

        return {
            ingresos,
            gastos: gastosMes,
            totalVentas,
            totalCreditos
        };

    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        return { ingresos: 0, gastos: 0, totalVentas: 0, totalCreditos: 0 };
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

        // Obtener y actualizar métricas del dashboard
        const metrics = await fetchDashboardMetrics();
        
        const ingresoTotalEl = document.getElementById('ingreso-total');
        const gastoTotalEl = document.getElementById('gasto-total');
        
        if (ingresoTotalEl) {
            ingresoTotalEl.textContent = `$${Number(metrics.ingresos).toFixed(2)}`;
        }
        
        if (gastoTotalEl) {
            gastoTotalEl.textContent = `$${Number(metrics.gastos).toFixed(2)}`;
        }

        // Opcional: mostrar métricas adicionales si existen los elementos
        const totalVentasEl = document.getElementById('total-ventas');
        const totalCreditosEl = document.getElementById('total-creditos');
        
        if (totalVentasEl) totalVentasEl.textContent = metrics.totalVentas;
        if (totalCreditosEl) totalCreditosEl.textContent = metrics.totalCreditos;

    } catch (e) {
        console.error('initLanding error', e);
        if (typeof displayError === 'function') displayError('No se pudo cargar información del dashboard.');
    }
}

async function initLanding() {
    await updateDashboardUI();
    
    // Actualizar cada 30 segundos para mantener datos frescos
    setInterval(updateDashboardUI, 30000);
}

function initSucursalModal() {
    const modalEl = document.getElementById('modalSucursal');
    sucursalModalInstance = new bootstrap.Modal(modalEl);

    document.getElementById('formSucursal').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            nombre: document.getElementById('inputSucursalNombre').value.trim(),
            sucursalKey: document.getElementById('inputSucursalKey').value.trim(),
            activo: document.getElementById('inputSucursalActivo').checked
        };

        try {
            const btn = document.getElementById('btnSubmitSucursal');
            btn.disabled = true;
            btn.textContent = 'Creando...';

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
                try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
                throw new Error(txt);
            }

            displayMessage && displayMessage('Sucursal creada correctamente.');
            sucursalModalInstance.hide();
            document.getElementById('formSucursal').reset();
            
            // Actualizar perfil del usuario para que tenga la nueva sucursal
            const updatedProfile = await getUserProfile({ forceRefresh: true });
            if (updatedProfile?.idSucursal) {
                displayMessage && displayMessage('Sucursal asignada a tu perfil correctamente.');
            }

        } catch (err) {
            console.error('createSucursal error', err);
            displayError(`No se pudo crear la sucursal: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitSucursal');
            btn.disabled = false;
            btn.textContent = 'Crear Sucursal';
        }
    });
}

function initClienteModal() {
    const modalEl = document.getElementById('modalCliente');
    clienteModalInstance = new bootstrap.Modal(modalEl);

    document.getElementById('formCliente').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            nombre: document.getElementById('inputClienteNombre').value.trim(),
            primerApellido: document.getElementById('inputClientePrimerApellido').value.trim(),
            segundoApellido: document.getElementById('inputClienteSegundoApellido').value.trim(),
            numeroTelefono: document.getElementById('inputClienteTelefono').value.trim(),
            creditoActivo: document.getElementById('inputClienteCredito').checked
        };

        try {
            const btn = document.getElementById('btnSubmitCliente');
            btn.disabled = true;
            btn.textContent = 'Creando...';

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
                try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
                throw new Error(txt);
            }

            displayMessage && displayMessage('Cliente creado correctamente.');
            clienteModalInstance.hide();
            document.getElementById('formCliente').reset();

        } catch (err) {
            console.error('createCliente error', err);
            displayError(`No se pudo crear el cliente: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitCliente');
            btn.disabled = false;
            btn.textContent = 'Crear Cliente';
        }
    });
}

async function initLanding() {
    await updateDashboardUI();
    initSucursalModal();
    initClienteModal();
    
    // Actualizar cada 30 segundos para mantener datos frescos
    setInterval(updateDashboardUI, 30000);
}

if (window.partialsReady) initLanding();
else document.addEventListener('partialsLoaded', initLanding);