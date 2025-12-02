// js/ventas.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

const GET_VENTAS_BY_SUCURSAL = (sucursalId) => `${BASE_API_URL}/sell/sucursal/${sucursalId}`;
const CREATE_VENTA_ENDPOINT = `${BASE_API_URL}/sell`;
const GET_CLIENTS_ENDPOINT = `${BASE_API_URL}/client`;

const ventasTableBody = () => document.querySelector('#ventasTable tbody');
const ventasEmpty = () => document.getElementById('ventas-empty');
const sucursalWarningEl = () => document.getElementById('sucursal-warning');

let currentSucursalId = null;
let modalInstance = null;
let currentClients = [];

function setSucursal(id) {
    currentSucursalId = id ? Number(id) : null;
    if (currentSucursalId) {
        localStorage.setItem('sucursalId', String(currentSucursalId));
        sucursalWarningEl().classList.add('d-none');
        document.getElementById('btnOpenNewSale').disabled = false;
    } else {
        localStorage.removeItem('sucursalId');
        sucursalWarningEl().classList.remove('d-none');
        document.getElementById('btnOpenNewSale').disabled = true;
    }
}

function showSucursalInputAlways(profile) {
    if (profile?.idSucursal) {
        document.getElementById('inputSucursalId').value = String(profile.idSucursal);
        setSucursal(profile.idSucursal); 
    } else {
        const stored = localStorage.getItem('sucursalId');
        if (stored) {
            document.getElementById('inputSucursalId').value = String(stored);
            setSucursal(Number(stored));
        } else {
            document.getElementById('inputSucursalId').value = '';
            setSucursal(null);
        }
    }
}

function renderSaleRow(sale) {
    const tr = document.createElement('tr');
    const fecha = new Date(sale.fecha || sale.createdAt || Date.now()).toLocaleString();
    const clienteNombre = sale.cliente?.persona ? 
        [sale.cliente.persona.nombre, sale.cliente.persona.primerApellido, sale.cliente.persona.segundoApellido]
            .filter(Boolean).join(' ') : 
        (sale.nombreCliente || 'Cliente');
    
    tr.innerHTML = `
    <td>${sale.idVenta ?? sale.id ?? ''}</td>
    <td>${fecha}</td>
    <td>${clienteNombre}</td>
    <td>${sale.concepto ?? sale.descripcion ?? ''}</td>
    <td class="text-end">${typeof (sale.totalVenta || sale.total) !== 'undefined' ? Number(sale.totalVenta || sale.total).toFixed(2) : ''}</td>
    <td>
        <button class="btn btn-sm btn-outline-secondary btn-view" data-id="${sale.idVenta || sale.id}"><i class="bi bi-eye"></i></button>
    </td>
    `;
    return tr;
}

function renderSalesTable(sales) {
    const tbody = ventasTableBody();
    tbody.innerHTML = '';
    if (!sales || sales.length === 0) {
        ventasEmpty().classList.remove('d-none');
        return;
    }
    ventasEmpty().classList.add('d-none');
    sales.forEach(s => tbody.appendChild(renderSaleRow(s)));
}

async function fetchSalesBySucursal(sucursalId) {
    if (!sucursalId) throw new Error('SucursalId no definido');
    const url = GET_VENTAS_BY_SUCURSAL(sucursalId);
    const token = localStorage.getItem('authToken');
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.ventas ?? data?.data ?? []);
}

async function createSale(salePayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(CREATE_VENTA_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(salePayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

function initModalLogic() {
    const modalEl = document.getElementById('modalNewSale');
    modalInstance = new bootstrap.Modal(modalEl);

    const inputCantidad = document.getElementById('inputCantidad');
    const inputPrecioUnitario = document.getElementById('inputPrecioUnitario');
    const inputTotal = document.getElementById('inputTotal');

    function updateTotal() {
        const cantidad = Number(inputCantidad.value || 0);
        const precio = Number(inputPrecioUnitario.value || 0);
        inputTotal.value = (cantidad * precio).toFixed(2);
    }

    inputCantidad.addEventListener('input', updateTotal);
    inputPrecioUnitario.addEventListener('input', updateTotal);

    document.getElementById('btnOpenNewSale').addEventListener('click', () => {
        if (!currentSucursalId) {
            displayError('Primero debes guardar la sucursal.');
            return;
        }
        const hoy = new Date().toISOString().substring(0, 10);
        document.getElementById('inputFecha').value = hoy;
        document.getElementById('formNewSale').reset();
        inputTotal.value = '0.00';
        modalInstance.show();
    });

    document.getElementById('formNewSale').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentSucursalId) {
            displayError('No hay sucursal definida. Ingresa el ID de sucursal primero.');
            return;
        }

        const selectedClientId = document.getElementById('selectCliente').value;
        const selectedClient = currentClients.find(c => (c.idCliente || c.id) == selectedClientId);
        
        const payload = {
            sucursal: { idSucursal: currentSucursalId },
            cliente: selectedClient ? { idCliente: selectedClient.idCliente || selectedClient.id } : { nombre: document.getElementById('inputClienteNuevo').value.trim() },
            fecha: document.getElementById('inputFecha').value,
            concepto: document.getElementById('inputConcepto').value.trim(),
            cantidad: Number(document.getElementById('inputCantidad').value || 0),
            precioUnitario: Number(document.getElementById('inputPrecioUnitario').value || 0),
            totalVenta: Number(document.getElementById('inputTotal').value || 0),
            notas: document.getElementById('inputNotas').value.trim()
        };

        try {
            const btn = document.getElementById('btnSubmitSale');
            btn.disabled = true;
            btn.textContent = 'Registrando...';

            await createSale(payload);

            modalInstance.hide();
            displayMessage && displayMessage('Venta registrada correctamente.');
            await loadSales();
        } catch (err) {
            console.error('createSale error', err);
            displayError(`No se pudo registrar la venta: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitSale');
            btn.disabled = false;
            btn.textContent = 'Registrar venta';
        }
    });
}

async function loadClients() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(GET_CLIENTS_ENDPOINT, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) {
            let txt = `Status ${res.status}`;
            try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
            throw new Error(txt);
        }
        const data = await res.json();
        currentClients = Array.isArray(data) ? data : (data?.clients ?? data?.data ?? []);
        
        // Actualizar select de clientes en el modal
        const selectCliente = document.getElementById('selectCliente');
        if (selectCliente) {
            selectCliente.innerHTML = '<option value="">Seleccionar cliente...</option>';
            currentClients.forEach(client => {
                const nombreCompleto = [client.nombre, client.primerApellido, client.segundoApellido]
                    .filter(Boolean).join(' ');
                const option = document.createElement('option');
                option.value = client.idCliente || client.id;
                option.textContent = nombreCompleto;
                selectCliente.appendChild(option);
            });
        }
    } catch (err) {
        console.error('loadClients error', err);
        currentClients = [];
    }
}

async function loadSales() {
    try {
        if (!currentSucursalId) {
            renderSalesTable([]);
            return;
        }
        
        // Cargar clientes primero
        await loadClients();
        
        const sales = await fetchSalesBySucursal(currentSucursalId);
        renderSalesTable(sales);
    } catch (err) {
        console.error('loadSales error', err);
        displayError(`Error cargando ventas: ${err.message || err}`);
    }
}

function initSucursalInputHandlers() {
    const input = document.getElementById('inputSucursalId');
    const btnSave = document.getElementById('btnSaveSucursal');

    btnSave.addEventListener('click', () => {
        const v = input.value;
        const id = Number(v);
        if (!id) {
            displayError('Ingresa un ID de sucursal válido.');
            return;
        }
        setSucursal(id);
        loadSales();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            btnSave.click();
        }
    });

    document.getElementById('btnRefreshSales').addEventListener('click', () => {
        loadSales();
    });

    document.querySelector('#ventasTable tbody').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-view');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        alert('Ver venta id: ' + id);
    });
}

async function init() {
    try {
        const profile = await getUserProfile().catch(err => {
            console.warn('getUserProfile falló: ', err);
            return null;
        });

        showSucursalInputAlways(profile || {});

        initModalLogic();
        initSucursalInputHandlers();

        const stored = localStorage.getItem('sucursalId');
        if (stored) {
            setSucursal(Number(stored)); await loadSales();
        }

        document.getElementById('btnOpenNewSale').disabled = true;
    } catch (err) {
        console.error('init ventas error', err);
        displayError('Error inicializando módulo de ventas.');
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);
