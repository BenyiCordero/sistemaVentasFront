// js/ventas.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://localhost:8081/api';

const GET_VENTAS_BY_SUCURSAL = (sucursalId) => `${BASE_API_URL}/sell/sucursal/${sucursalId}`;
const CREATE_VENTA_ENDPOINT = `${BASE_API_URL}/sell`;
const CREATE_VENTADETAILS_ENDPOINT = `${BASE_API_URL}/sellDetails`;
const GET_VENTA_DETAILS_BY_VENTA = (idVenta) => `${BASE_API_URL}/sellDetails/venta/${idVenta}`;
const UPDATE_VENTA_ENDPOINT = `${BASE_API_URL}/sell`;
const UPDATE_VENTADETAILS_ENDPOINT = `${BASE_API_URL}/sellDetails`;
const GET_INVENTORY_DETAILS_BY_PRODUCT = (idProducto) => `${BASE_API_URL}/inventoryDetails/producto/${idProducto}`;
const UPDATE_INVENTORY_DETAIL_ENDPOINT = (id) => `${BASE_API_URL}/inventoryDetails/${id}`;
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

    const details = sale.details && sale.details.length > 0 ? sale.details[0] : null;
    const productoNombre = details?.producto?.nombre || details?.nombreProducto || '';
    const cantidad = details?.cantidad || '';
    const totalVenta = typeof (sale.totalVenta || sale.total) !== 'undefined' ? Number(sale.totalVenta || sale.total).toFixed(2) : '';
    const metodoPago = sale.metodoPago || '';
    const estado = sale.estado || '';

    tr.innerHTML = `
    <td><i class="bi bi-receipt text-muted"></i> ${sale.idVenta ?? sale.id ?? ''}</td>
    <td>${fecha}</td>
    <td><span class="fw-semibold">${clienteNombre}</span></td>
    <td>${productoNombre || 'N/A'}</td>
    <td>${cantidad || ''}</td>
    <td>$ ${totalVenta}</td>
    <td>${metodoPago ? `<span class="badge bg-secondary">${metodoPago}</span>` : ''}</td>
    <td>${estado ? `<span class="badge bg-secondary">${estado}</span>` : ''}</td>
    <td class="text-center">
        <button class="btn btn-sm btn-outline-info btn-view me-1" data-id="${sale.idVenta || sale.id}" title="Ver detalles completos"><i class="bi bi-eye"></i></button>
        <button disabled class="btn btn-sm btn-outline-warning btn-modify" data-id="${sale.idVenta || sale.id}" title="Modificar venta"><i class="bi bi-pencil-square"></i></button>
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
    localStorage.setItem('cachedSales', JSON.stringify(sales)); // Cache for modals
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
     if (res.status === 404 || res.status === 204) {
        return [];
    }

    if (!res.ok) {
        throw new Error(data?.message || `Error ${res.status}`);
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
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function fetchVentaDetails(idVenta) {
    const token = localStorage.getItem('authToken');
    const url = GET_VENTA_DETAILS_BY_VENTA(idVenta);
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
    return Array.isArray(data) ? data : (data?.details ?? []);
}

async function updateSale(ventaPayload, idVenta) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${UPDATE_VENTA_ENDPOINT}/${idVenta}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(ventaPayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function updateVentaDetails(detailsPayload, idVentaDetails) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${UPDATE_VENTADETAILS_ENDPOINT}/${idVentaDetails}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(detailsPayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function getInventoryDetails(idProducto) {
    const token = localStorage.getItem('authToken');
    const url = GET_INVENTORY_DETAILS_BY_PRODUCT(idProducto);
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
    return Array.isArray(data) ? data : [];
}

async function updateInventoryDetail(id, payload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(UPDATE_INVENTORY_DETAIL_ENDPOINT(id), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    return handleResponse(res); // <--- usar handleResponse evita body already read
}

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

function initModalLogic() {
    const modalEl = document.getElementById('modalNewSale');
    modalInstance = new bootstrap.Modal(modalEl);

    const inputCantidad = document.getElementById('inputCantidad');
    const inputPrecioUnitario = document.getElementById('inputPrecioUnitario');
    const inputDescuento = document.getElementById('inputDescuento');
    const inputImpuesto = document.getElementById('inputImpuesto');
    const inputTotal = document.getElementById('inputTotal');
    const selectProducto = document.getElementById('selectProducto');

    

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
        document.getElementById('formNewSale').removeAttribute('data-modifying');
        document.getElementById('formNewSale').removeAttribute('data-sale-id');
        inputTotal.value = '0.00';
        inputPrecioUnitario.value = '0.00';
        inputDescuento.value = '0';
        inputImpuesto.value = '0';
        document.getElementById('inputMetodoPago').value = '';
        // Limpiar inputs de autocompletado
        document.getElementById('inputCliente').value = '';
        document.getElementById('idCliente').value = '';
        document.getElementById('inputProducto').value = '';
        document.getElementById('idProducto').value = '';

        // Cargar listas si no inicializado
        await loadClients();
        currentProducts = await loadProductsBySucursal(currentSucursalId);

        autocompleteInitialized = false;

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
     const metodoPago = document.getElementById('inputMetodoPago').value;
     if (!metodoPago) {
         displayError('Debes seleccionar un método de pago.');
         return;
     }
     const subtotal = cantidad * precioUnitario;

    try {
        const inventoryDetails = await getInventoryDetails(selectedProductId);
        const totalStock = inventoryDetails.reduce((sum, detail) => sum + (detail.cantidad || 0), 0);
        if (totalStock < cantidad) {
            displayError(`Stock insuficiente. Disponible: ${totalStock}, requerido: ${cantidad}`);
            return;
        }
    } catch (err) {
        console.warn('Error checking stock:', err);
        displayError('Error al verificar stock. Intenta nuevamente.');
        return;
    }

    const isModifying = document.getElementById('formNewSale').getAttribute('data-modifying') === 'true';
    const modifyingSaleId = document.getElementById('formNewSale').getAttribute('data-sale-id');

    const btn = document.getElementById('btnSubmitSale');
    btn.disabled = true;
    btn.textContent = isModifying ? 'Modificando...' : 'Registrando...';

    try {
        const profile = await getUserProfile();
        const idTrabajador = profile.id;

         const ventaPayload = {
             idSucursal: currentSucursalId,
             idCliente: selectedClient.idCliente || selectedClient.id,
             idTrabajador,
             totalVenta,
             descuento,
             impuesto,
             notas,
             metodoPago
         };

        let idVenta;
        if (isModifying) {
            await updateSale(ventaPayload, modifyingSaleId);
            idVenta = modifyingSaleId;
        } else {
            const ventaResponse = await createSale(ventaPayload);
            idVenta = ventaResponse.idVenta;
        }

        const detailsPayload = {
            idProducto: Number(selectedProductId),
            idVenta,
            cantidad,
            precio: precioUnitario,
            subtotal
        };

        if (isModifying) {
            const sales = JSON.parse(localStorage.getItem('cachedSales') || '[]');
            const sale = sales.find(s => (s.idVenta || s.id) == modifyingSaleId);
            if (sale?.details?.length > 0) {
                const detailId = sale.details[0].idVentaDetails || sale.details[0].id;
                await updateVentaDetails(detailsPayload, detailId);
            }
        } else {
            await createVentaDetails(detailsPayload);

            const inventoryDetails = await getInventoryDetails(selectedProductId);
            const availableDetail = inventoryDetails.find(d => d.cantidad > 0);
            if (!availableDetail) {
                displayError('No hay stock disponible para actualizar inventario.');
            } else {
                const newCantidad = availableDetail.cantidad - cantidad;
                const updatePayload = {
                    cantidad: newCantidad,
                    estado: availableDetail.estado,
                    disponible: newCantidad > 0
                };
                try {
                    await updateInventoryDetail(availableDetail.idDetalle, updatePayload);
                } catch (err) {
                    console.warn('No se pudo actualizar inventario:', err);
                    displayError(`Venta creada, pero no se pudo actualizar inventario: ${err.message}`);
                }
            }
        }

        modalInstance.hide();
        displayMessage(isModifying ? 'Venta modificada correctamente.' : 'Venta registrada correctamente.');
        await loadSales();
    } catch (err) {
        console.error('Error en registro de venta', err);
        if (err.message.includes('venta') || err.message.includes('Status')) {
            displayError(`Error creando venta: ${err.message || err}`);
        } else if (err.message.includes('inventory') || err.message.includes('inventario')) {
            displayError(`Venta creada, pero error actualizando inventario: ${err.message || err}`);
        } else {
            displayError(`Venta creada, pero error en detalle: ${err.message || err}`);
        }
    } finally {
        btn.disabled = false;
        btn.textContent = 'Registrar venta';
        document.getElementById('formNewSale').removeAttribute('data-modifying');
        document.getElementById('formNewSale').removeAttribute('data-sale-id');
        document.querySelector('#modalNewSale .modal-title').textContent = 'Registrar nueva venta';
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

async function loadProductsBySucursal(sucursalId) {
    try {
        const token = localStorage.getItem('authToken');

        const invRes = await fetch(`${BASE_API_URL}/inventory/${sucursalId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!invRes.ok) return [];

        const inventario = await invRes.json();
        const inventarioId = inventario.idInventario || inventario.id;

        const detRes = await fetch(`${BASE_API_URL}/inventoryDetails/inventario/${inventarioId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!detRes.ok) return [];

        const details = await detRes.json();

        const productMap = new Map();
        details.forEach(d => {
            if (!d.producto) return;
            const id = d.producto.idProducto || d.producto.id;
            if (!productMap.has(id)) {
                productMap.set(id, d.producto);
            }
        });

        return Array.from(productMap.values());
    } catch (err) {
        console.error('loadProductsBySucursal error', err);
        return [];
    }
}


function openViewModal(idVenta) {
    const sales = JSON.parse(localStorage.getItem('cachedSales') || '[]');
    const sale = sales.find(s => (s.idVenta || s.id) == idVenta);
    if (!sale) {
        displayError('Venta no encontrada.');
        return;
    }

    const content = document.getElementById('viewSaleContent');
    const fecha = new Date(sale.fecha || sale.createdAt || Date.now()).toLocaleString();
    const clienteNombre = sale.cliente?.persona ?
        [sale.cliente.persona.nombre, sale.cliente.persona.primerApellido, sale.cliente.persona.segundoApellido]
            .filter(Boolean).join(' ') : (sale.nombreCliente || 'Cliente');

    let html = `
        <div class="card mb-3">
            <div class="card-header bg-light">
                <h6 class="mb-0"><i class="bi bi-info-circle text-primary"></i> Información General de la Venta</h6>
            </div>
            <div class="card-body">
                 <div class="row g-3">
                     <div class="col-12 col-md-6">
                         <strong>ID Venta:</strong> <span class="badge bg-secondary">${sale.idVenta || sale.id}</span>
                     </div>
                     <div class="col-12 col-md-6">
                         <strong>Fecha:</strong> ${fecha}
                     </div>
                     <div class="col-12 col-md-6">
                         <strong>Cliente:</strong> <span class="fw-semibold">${clienteNombre}</span>
                     </div>
                     <div class="col-12 col-md-6">
                         <strong>Total:</strong> $ ${Number(sale.totalVenta || sale.total).toFixed(2)}
                     </div>
                     <div class="col-12 col-md-6">
                         <strong>Descuento:</strong> ${Number(sale.descuento || 0).toFixed(2)}%
                     </div>
                     <div class="col-12 col-md-6">
                         <strong>Impuesto:</strong> ${Number(sale.impuesto || 0).toFixed(2)}%
                     </div>
                     <div class="col-12 col-md-6">
                         <strong>Método de Pago:</strong> <span class="badge bg-secondary">${sale.metodoPago || 'No especificado'}</span>
                     </div>
                     <div class="col-12 col-md-6">
                         <strong>Estado:</strong> <span class="badge bg-secondary">${sale.estado || 'No especificado'}</span>
                     </div>
                     <div class="col-12">
                         <strong>Notas:</strong> ${sale.notas || 'Sin notas'}
                     </div>
                 </div>
            </div>
        </div>
        <div class="card">
            <div class="card-header bg-light">
                <h6 class="mb-0"><i class="bi bi-box-seam text-primary"></i> Detalles del Producto</h6>
            </div>
            <div class="card-body">
    `;

    if (sale.details && sale.details.length > 0) {
        html += '<div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unitario</th><th>Subtotal</th></tr></thead><tbody>';
        sale.details.forEach(detail => {
            html += `
                <tr>
                    <td>${detail.producto?.nombre || detail.nombreProducto || 'N/A'}</td>
                    <td>${detail.cantidad}</td>
                    <td>$ ${Number(detail.precio).toFixed(2)}</td>
                    <td>$ ${Number(detail.subtotal).toFixed(2)}</td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
    } else {
        html += '<p class="text-muted">No hay detalles disponibles para esta venta.</p>';
    }
    html += '</div></div>';

    content.innerHTML = html;
    const modal = new bootstrap.Modal(document.getElementById('modalViewSale'));
    modal.show();
}

async function openModifyModal(idVenta) {
    const sales = JSON.parse(localStorage.getItem('cachedSales') || '[]');
    const sale = sales.find(s => (s.idVenta || s.id) == idVenta);
    if (!sale) {
        displayError('Venta no encontrada.');
        return;
    }

    // Pre-fill modal with sale data
    document.getElementById('formNewSale').reset();
    const inputCliente = document.getElementById('inputCliente');
    const idCliente = document.getElementById('idCliente');
    const inputProducto = document.getElementById('inputProducto');
    const idProducto = document.getElementById('idProducto');
    const inputCantidad = document.getElementById('inputCantidad');
    const inputPrecioUnitario = document.getElementById('inputPrecioUnitario');
    const inputDescuento = document.getElementById('inputDescuento');
    const inputImpuesto = document.getElementById('inputImpuesto');
    const inputTotal = document.getElementById('inputTotal');
    const inputNotas = document.getElementById('inputNotas');

    const clienteNombre = sale.cliente?.persona ?
        [sale.cliente.persona.nombre, sale.cliente.persona.primerApellido, sale.cliente.persona.segundoApellido]
            .filter(Boolean).join(' ') : (sale.nombreCliente || '');
    inputCliente.value = clienteNombre;
    idCliente.value = sale.cliente?.idCliente || '';

    if (sale.details && sale.details.length > 0) {
        const detail = sale.details[0];
        const productoNombre = detail.producto?.nombre || detail.nombreProducto || '';
        inputProducto.value = productoNombre;
        idProducto.value = detail.idProducto;
        inputCantidad.value = detail.cantidad;
        inputPrecioUnitario.value = Number(detail.precio).toFixed(2);
         inputDescuento.value = Number(sale.descuento || 0).toFixed(2);
         inputImpuesto.value = Number(sale.impuesto || 0).toFixed(2);
         inputTotal.value = Number(sale.totalVenta || sale.total).toFixed(2);
         inputNotas.value = sale.notas || '';
         document.getElementById('inputMetodoPago').value = sale.metodoPago || '';
    }

    // Set flag for modification
    document.getElementById('formNewSale').setAttribute('data-modifying', 'true');
    document.getElementById('formNewSale').setAttribute('data-sale-id', idVenta);

    // Change modal title
    document.querySelector('#modalNewSale .modal-title').textContent = 'Modificar Venta';

    modalInstance.show();
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
        // Fetch details for each sale
        for (const sale of sales) {
            try {
                const details = await fetchVentaDetails(sale.idVenta || sale.id);
                sale.details = details;
            } catch (err) {
                console.warn(`Error fetching details for sale ${sale.idVenta || sale.id}:`, err);
                sale.details = [];
            }
        }
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

    document.querySelector('#ventasTable tbody').addEventListener('click', async (e) => {
        const btnView = e.target.closest('.btn-view');
        const btnModify = e.target.closest('.btn-modify');
        if (btnView) {
            const id = btnView.getAttribute('data-id');
            openViewModal(id);
        } else if (btnModify) {
            const id = btnModify.getAttribute('data-id');
            await openModifyModal(id);
        }
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
