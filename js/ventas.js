// js/ventas.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

const GET_VENTAS_BY_SUCURSAL = (sucursalId) => `${BASE_API_URL}/sell/sucursal/${sucursalId}`;
const CREATE_VENTA_ENDPOINT = `${BASE_API_URL}/sell`;
const GET_CLIENTS_ENDPOINT = `${BASE_API_URL}/client`;
const GET_PRODUCTS_ENDPOINT = `${BASE_API_URL}/product`;

const ventasTableBody = () => document.querySelector('#ventasTable tbody');
const ventasEmpty = () => document.getElementById('ventas-empty');
const sucursalWarningEl = () => document.getElementById('sucursal-warning');

let currentSucursalId = null;
let modalInstance = null;
let currentClients = [];
let currentProducts = [];

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
    const inputDescuento = document.getElementById('inputDescuento');
    const inputImpuesto = document.getElementById('inputImpuesto');
    const inputTotal = document.getElementById('inputTotal');
    const selectProducto = document.getElementById('selectProducto');

    function updateTotal() {
        const cantidad = Number(inputCantidad.value || 0);
        const precio = Number(inputPrecioUnitario.value || 0);
        const descuento = Number(inputDescuento.value || 0);
        const impuesto = Number(inputImpuesto.value || 0);
        const subtotal = cantidad * precio;
        const descuentoAmount = subtotal * (descuento / 100);
        const subtotalAfterDescuento = subtotal - descuentoAmount;
        const impuestoAmount = subtotalAfterDescuento * (impuesto / 100);
        inputTotal.value = (subtotalAfterDescuento + impuestoAmount).toFixed(2);
    }

    inputCantidad.addEventListener('input', updateTotal);
    inputPrecioUnitario.addEventListener('input', updateTotal);
    inputDescuento.addEventListener('input', updateTotal);
    inputImpuesto.addEventListener('input', updateTotal);

    selectProducto.addEventListener('change', (e) => {
        const selectedOption = e.target.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.precio) {
            inputPrecioUnitario.value = Number(selectedOption.dataset.precio).toFixed(2);
            updateTotal();
        }
    });

    document.getElementById('btnOpenNewSale').addEventListener('click', () => {
        if (!currentSucursalId) {
            displayError('Primero debes guardar la sucursal.');
            return;
        }
        document.getElementById('formNewSale').reset();
        inputTotal.value = '0.00';
        inputDescuento.value = '0';
        inputImpuesto.value = '0';
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
        
        const selectedProductId = selectProducto.value;
        const selectedProduct = currentProducts.find(p => (p.idProducto || p.id) == selectedProductId);

        const payload = {
            sucursal: { idSucursal: currentSucursalId },
            cliente: selectedClient ? { idCliente: selectedClient.idCliente || selectedClient.id } : { nombre: document.getElementById('inputClienteNuevo').value.trim() },
            fecha: document.getElementById('inputFecha').value,
            concepto: selectedProduct ? selectedProduct.nombre : document.getElementById('inputConcepto').value.trim(),
            cantidad: Number(document.getElementById('inputCantidad').value || 0),
            precioUnitario: Number(document.getElementById('inputPrecioUnitario').value || 0),
            descuento: Number(document.getElementById('inputDescuento').value || 0),
            impuesto: Number(document.getElementById('inputImpuesto').value || 0),
            totalVenta: Number(document.getElementById('inputTotal').value || 0),
            idProducto: selectedProductId ? Number(selectedProductId) : null,
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
                const nombreCompleto = [client.persona.nombre, client.persona.primerApellido, client.persona.segundoApellido]
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

async function loadProducts() {
    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(GET_PRODUCTS_ENDPOINT, {
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
        currentProducts = Array.isArray(data) ? data : (data?.products ?? data?.data ?? []);

        // Actualizar select de productos en el modal
        const selectProducto = document.getElementById('selectProducto');
        if (selectProducto) {
            selectProducto.innerHTML = '<option value="">Seleccionar producto...</option>';
            currentProducts.forEach(product => {
                const option = document.createElement('option');
                option.value = product.idProducto || product.id;
                option.textContent = product.nombre || product.modelo || `Producto ${product.idProducto}`;
                option.dataset.precio = product.precio || 0;
                selectProducto.appendChild(option);
            });
        }
    } catch (err) {
        console.error('loadProducts error', err);
        currentProducts = [];
    }
}

async function loadSales() {
    try {
        if (!currentSucursalId) {
            renderSalesTable([]);
            return;
        }
        
        // Cargar clientes y productos
        await loadClients();
        await loadProducts();
        
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
    } catch (err) {
        console.error('init ventas error', err);
        displayError('Error inicializando módulo de ventas.');
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);
