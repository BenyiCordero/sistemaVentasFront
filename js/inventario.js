// js/inventario.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

const GET_PRODUCTS_ENDPOINT = `${BASE_API_URL}/product`;
const CREATE_PRODUCT_ENDPOINT = `${BASE_API_URL}/product`;
const UPDATE_PRODUCT_ENDPOINT = (id) => `${BASE_API_URL}/product/${id}`;
const DELETE_PRODUCT_ENDPOINT = (id) => `${BASE_API_URL}/product/${id}`;

const productsTableBody = () => document.querySelector('#productsTable tbody');
const productsEmpty = () => document.getElementById('products-empty');

let currentProducts = [];
let modalInstance = null;
let editingProductId = null;

function getStockStatus(stock, stockMinimo) {
    if (stock === 0) return { text: 'Agotado', class: 'danger' };
    if (stock <= stockMinimo) return { text: 'Bajo stock', class: 'warning' };
    return { text: 'Activo', class: 'success' };
}

function renderProductRow(product) {
    const tr = document.createElement('tr');
    const status = getStockStatus(product.stock, product.stockMinimo);
    
    tr.innerHTML = `
    <td>${product.idProducto ?? product.id ?? ''}</td>
    <td>${product.codigo ?? ''}</td>
    <td>${product.nombre ?? ''}</td>
    <td><span class="badge bg-secondary">${product.categoria ?? ''}</span></td>
    <td>${product.stock ?? 0}</td>
    <td class="text-end">$${typeof product.precio !== 'undefined' ? Number(product.precio).toFixed(2) : '0.00'}</td>
    <td><span class="badge bg-${status.class}">${status.text}</span></td>
    <td>
        <button class="btn btn-sm btn-outline-primary btn-edit me-1" data-id="${product.idProducto || product.id}">
            <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${product.idProducto || product.id}">
            <i class="bi bi-trash"></i>
        </button>
    </td>
    `;
    return tr;
}

function renderProductsTable(products) {
    const tbody = productsTableBody();
    tbody.innerHTML = '';
    if (!products || products.length === 0) {
        productsEmpty().classList.remove('d-none');
        return;
    }
    productsEmpty().classList.add('d-none');
    products.forEach(product => tbody.appendChild(renderProductRow(product)));
}

function filterProducts() {
    const searchTerm = document.getElementById('inputSearch').value.toLowerCase();
    const categoryFilter = document.getElementById('selectCategory').value;
    const statusFilter = document.getElementById('selectStatus').value;

    let filtered = currentProducts.filter(product => {
        const matchesSearch = !searchTerm || 
            (product.nombre?.toLowerCase().includes(searchTerm) || 
             product.codigo?.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !categoryFilter || product.categoria === categoryFilter;
        
        const status = getStockStatus(product.stock, product.stockMinimo);
        const matchesStatus = !statusFilter || 
            (statusFilter === 'activo' && status.class === 'success') ||
            (statusFilter === 'bajo_stock' && status.class === 'warning') ||
            (statusFilter === 'agotado' && status.class === 'danger');

        return matchesSearch && matchesCategory && matchesStatus;
    });

    renderProductsTable(filtered);
}

async function fetchProducts() {
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
    return Array.isArray(data) ? data : (data?.products ?? data?.data ?? []);
}

async function createProduct(productPayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(CREATE_PRODUCT_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productPayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function updateProduct(id, productPayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(UPDATE_PRODUCT_ENDPOINT(id), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(productPayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function deleteProduct(id) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(DELETE_PRODUCT_ENDPOINT(id), {
        method: 'DELETE',
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
    return true;
}

function initModalLogic() {
    const modalEl = document.getElementById('modalProduct');
    modalInstance = new bootstrap.Modal(modalEl);

    document.getElementById('btnOpenNewProduct').addEventListener('click', () => {
        editingProductId = null;
        document.getElementById('modalProductTitle').textContent = 'Nuevo producto';
        document.getElementById('formProduct').reset();
        document.getElementById('inputStock').value = '0';
        document.getElementById('inputStockMinimo').value = '5';
        modalInstance.show();
    });

    document.getElementById('formProduct').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            nombre: document.getElementById('inputNombre').value.trim(),
            descripcion: document.getElementById('inputDescripcion').value.trim(),
            marca: document.getElementById('inputMarca').value.trim(),
            modelo: document.getElementById('inputModelo').value.trim(),
            imei: document.getElementById('inputImei').value.trim(),
            categoria: document.getElementById('selectCategoria').value,
            costo: Number(document.getElementById('inputCosto').value || 0),
            precio: Number(document.getElementById('inputPrecio').value || 0),
            stock: Number(document.getElementById('inputStock').value || 0),
            activo: document.getElementById('inputActivo').checked
        };

        try {
            const btn = document.getElementById('btnSubmitProduct');
            btn.disabled = true;
            btn.textContent = editingProductId ? 'Actualizando...' : 'Guardando...';

            if (editingProductId) {
                await updateProduct(editingProductId, payload);
                displayMessage && displayMessage('Producto actualizado correctamente.');
            } else {
                await createProduct(payload);
                displayMessage && displayMessage('Producto creado correctamente.');
            }

            modalInstance.hide();
            await loadProducts();
        } catch (err) {
            console.error('saveProduct error', err);
            displayError(`No se pudo guardar el producto: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitProduct');
            btn.disabled = false;
            btn.textContent = 'Guardar producto';
        }
    });
}

function initTableHandlers() {
    document.getElementById('btnRefreshProducts').addEventListener('click', () => {
        loadProducts();
    });

    document.getElementById('btnFilter').addEventListener('click', () => {
        filterProducts();
    });

    document.getElementById('inputSearch').addEventListener('input', () => {
        filterProducts();
    });

    document.getElementById('selectCategory').addEventListener('change', () => {
        filterProducts();
    });

    document.getElementById('selectStatus').addEventListener('change', () => {
        filterProducts();
    });

    document.querySelector('#productsTable tbody').addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        const btnDelete = e.target.closest('.btn-delete');

        if (btnEdit) {
            const id = btnEdit.getAttribute('data-id');
            const product = currentProducts.find(p => (p.idProducto || p.id) == id);
            if (product) {
                editingProductId = id;
                document.getElementById('modalProductTitle').textContent = 'Editar producto';
                document.getElementById('inputNombre').value = product.nombre || '';
                document.getElementById('inputCodigo').value = product.codigo || '';
                document.getElementById('inputDescripcion').value = product.descripcion || '';
                document.getElementById('inputMarca').value = product.marca || '';
                document.getElementById('inputModelo').value = product.modelo || '';
                document.getElementById('inputImei').value = product.imei || '';
                document.getElementById('selectCategoria').value = product.categoria || '';
                document.getElementById('inputCosto').value = product.costo || 0;
                document.getElementById('inputPrecio').value = product.precio || 0;
                document.getElementById('inputStock').value = product.stock || 0;
                document.getElementById('inputActivo').checked = product.activo !== false;
                modalInstance.show();
            }
        }

        if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
                try {
                    await deleteProduct(id);
                    displayMessage && displayMessage('Producto eliminado correctamente.');
                    await loadProducts();
                } catch (err) {
                    console.error('deleteProduct error', err);
                    displayError(`No se pudo eliminar el producto: ${err.message || err}`);
                }
            }
        }
    });
}

async function loadProducts() {
    try {
        const products = await fetchProducts();
        currentProducts = products;
        filterProducts();
    } catch (err) {
        console.error('loadProducts error', err);
        displayError(`Error cargando productos: ${err.message || err}`);
        renderProductsTable([]);
    }
}

async function init() {
    try {
        await getUserProfile().catch(err => {
            console.warn('getUserProfile falló: ', err);
            return null;
        });

        initModalLogic();
        initTableHandlers();
        await loadProducts();
    } catch (err) {
        console.error('init inventario error', err);
        displayError('Error inicializando módulo de inventario.');
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);