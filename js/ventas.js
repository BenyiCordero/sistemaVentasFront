// js/ventas.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

const GET_VENTAS_BY_SUCURSAL = (sucursalId) => `${BASE_API_URL}/sell/sucursal/${sucursalId}`;
const CREATE_VENTA_ENDPOINT = `${BASE_API_URL}/sell`;
const CREATE_VENTADETAILS_ENDPOINT = `${BASE_API_URL}/sellDetails`;
const GET_CLIENTS_ENDPOINT = `${BASE_API_URL}/client`;
const GET_PRODUCTS_ENDPOINT = `${BASE_API_URL}/product`;

const ventasTableBody = () => document.querySelector('#ventasTable tbody');
const ventasEmpty = () => document.getElementById('ventas-empty');
const sucursalWarningEl = () => document.getElementById('sucursal-warning');

let currentSucursalId = null;
let modalInstance = null;
let currentClients = [];
let currentProducts = [];
let autocompleteInitialized = false;

// Funciones de autocompletado
function filterList(list, query, displayFn) {
    if (!query) return list.slice(0, 20); // mostrar primeros 20 cuando vacío
    return list.filter(item => displayFn(item).toLowerCase().includes(query.toLowerCase())).slice(0, 20);
}

function renderSuggestions(suggestionsEl, filtered, displayFn, onSelect) {
    suggestionsEl.innerHTML = '';
    if (filtered.length === 0) {
        const noResults = document.createElement('div');
        noResults.textContent = 'No se encontraron resultados';
        noResults.className = 'autocomplete-item no-results';
        suggestionsEl.appendChild(noResults);
        return;
    }
    filtered.forEach(item => {
        const div = document.createElement('div');
        div.textContent = displayFn(item);
        div.className = 'autocomplete-item';
        div.addEventListener('click', () => onSelect(item));
        suggestionsEl.appendChild(div);
    });
}

function initAutocomplete(inputEl, hiddenEl, suggestionsEl, list, displayFn) {
    let selectedIndex = -1;
    let filtered = [];

    function updateSuggestions(query) {
        filtered = filterList(list, query, displayFn);
        renderSuggestions(suggestionsEl, filtered, displayFn, (item) => {
            inputEl.value = displayFn(item);
            hiddenEl.value = item.idCliente || item.idProducto || item.id;
            hideSuggestions();
        // Si es producto, setear precio
        if (item.precio !== undefined) {
            const inputPrecio = document.getElementById('inputPrecioUnitario');
            if (inputPrecio) inputPrecio.value = Number(item.precio).toFixed(2);
        }
        updateTotal();
        });
        selectedIndex = -1;
    }

    function showSuggestions() {
        suggestionsEl.style.display = 'block';
    }

    function hideSuggestions() {
        suggestionsEl.style.display = 'none';
    }

    inputEl.addEventListener('focus', () => {
        updateSuggestions(inputEl.value);
        showSuggestions();
    });

    inputEl.addEventListener('input', () => {
        updateSuggestions(inputEl.value);
        showSuggestions();
    });

    inputEl.addEventListener('keydown', (e) => {
        if (!filtered.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % filtered.length;
            updateHighlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = selectedIndex <= 0 ? filtered.length - 1 : selectedIndex - 1;
            updateHighlight();
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            const item = filtered[selectedIndex];
            inputEl.value = displayFn(item);
            hiddenEl.value = item.idCliente || item.idProducto || item.id;
            hideSuggestions();
    if (item.precio !== undefined) {
        const inputPrecio = document.getElementById('inputPrecioUnitario');
        if (inputPrecio) inputPrecio.value = Number(item.precio).toFixed(2);
    }
    updateTotal();
        } else if (e.key === 'Escape') {
            hideSuggestions();
        }
    });

    inputEl.addEventListener('blur', () => {
        setTimeout(hideSuggestions, 150); // delay para permitir click
    });

    function updateHighlight() {
        const items = suggestionsEl.querySelectorAll('.autocomplete-item');
        items.forEach((el, i) => {
            if (i === selectedIndex) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        });
    }
}

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
    return handleResponse(res);
}

async function createVentaDetails(detailsPayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(CREATE_VENTADETAILS_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(detailsPayload)
    });
    return handleResponse(res);
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

    document.getElementById('btnOpenNewSale').addEventListener('click', async () => {
        if (!currentSucursalId) {
            displayError('Primero debes guardar la sucursal.');
            return;
        }
        document.getElementById('formNewSale').reset();
        inputTotal.value = '0.00';
        inputPrecioUnitario.value = '0.00';
        inputDescuento.value = '0';
        inputImpuesto.value = '0';
        // Limpiar inputs de autocompletado
        document.getElementById('inputCliente').value = '';
        document.getElementById('idCliente').value = '';
        document.getElementById('inputProducto').value = '';
        document.getElementById('idProducto').value = '';

        // Cargar listas si no inicializado
        await loadClients();
        await loadProducts();
        if (!autocompleteInitialized) {
            initAutocomplete(
                document.getElementById('inputCliente'),
                document.getElementById('idCliente'),
                document.getElementById('clienteSuggestions'),
                currentClients,
                (client) => [client.persona.nombre, client.persona.primerApellido, client.persona.segundoApellido].filter(Boolean).join(' ')
            );
            initAutocomplete(
                document.getElementById('inputProducto'),
                document.getElementById('idProducto'),
                document.getElementById('productoSuggestions'),
                currentProducts,
                (product) => product.nombre || product.modelo || `Producto ${product.idProducto}`
            );
            autocompleteInitialized = true;
        }
        modalInstance.show();
    });

    document.getElementById('formNewSale').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentSucursalId) {
            displayError('No hay sucursal definida. Ingresa el ID de sucursal primero.');
            return;
        }

        const selectedClientId = document.getElementById('idCliente').value;
        const selectedClient = currentClients.find(c => (c.idCliente || c.id) == selectedClientId);

        const selectedProductId = document.getElementById('idProducto').value;
        const selectedProduct = currentProducts.find(p => (p.idProducto || p.id) == selectedProductId);

        if (!selectedClient || !selectedProduct) {
            displayError('Debes seleccionar un cliente y un producto.');
            return;
        }

        const cantidad = Number(document.getElementById('inputCantidad').value || 0);
        const precioUnitario = Number(document.getElementById('inputPrecioUnitario').value || 0);
        const descuento = Number(document.getElementById('inputDescuento').value || 0);
        const impuesto = Number(document.getElementById('inputImpuesto').value || 0);
        const totalVenta = Number(document.getElementById('inputTotal').value || 0);
        const notas = document.getElementById('inputNotas').value.trim();

        const subtotal = cantidad * precioUnitario;

        try {
            const btn = document.getElementById('btnSubmitSale');
            btn.disabled = true;
            btn.textContent = 'Registrando...';

            const profile = await getUserProfile();
            const idTrabajador = profile.id;

            const ventaPayload = {
                idSucursal: currentSucursalId,
                idCliente: selectedClient.idCliente || selectedClient.id,
                idTrabajador,
                totalVenta,
                descuento,
                impuesto,
                notas
            };

            const ventaResponse = await createSale(ventaPayload);
            const idVenta = ventaResponse.idVenta;

            const detailsPayload = {
                idProducto: Number(selectedProductId),
                idVenta,
                cantidad,
                precio: precioUnitario,
                subtotal
            };

            await createVentaDetails(detailsPayload);

            modalInstance.hide();
            displayMessage('Venta registrada correctamente.');
            await loadSales();
        } catch (err) {
            console.error('Error en registro de venta', err);
            if (err.message.includes('venta') || err.message.includes('Status')) {
                displayError(`Error creando venta: ${err.message || err}`);
            } else {
                displayError(`Venta creada, pero error en detalle: ${err.message || err}`);
            }
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

async function handleResponse(res) {
    const text = await res.text(); // leer body solo una vez
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
        const msg = data?.message || text || `Status ${res.status}`;
        throw new Error(msg);
    }
    return data;
}


async function init() {
    try {
        const profile = await getUserProfile().catch(err => {
            console.warn('getUserProfile falló: ', err);
            return null;
        });

        // Agregar estilos para autocompletado
        const style = document.createElement('style');
        style.textContent = `
.autocomplete-dropdown {
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    width: 300px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
#inputCliente, #inputProducto {
    max-width: 300px;
}
.autocomplete-item {
    padding: 8px 12px;
    cursor: pointer;
    border-bottom: 1px solid #eee;
}
.autocomplete-item:hover, .autocomplete-item.selected {
    background: #f8f9fa;
}
.autocomplete-item.no-results {
    color: #6c757d;
    cursor: default;
}
`;
        document.head.appendChild(style);

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
