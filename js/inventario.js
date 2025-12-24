import { getUserProfile } from './session.js';
import { notifySuccess, notifyError } from './utils.js';

const BASE_API_URL = 'http://localhost:8081/api';

let products = [];
let inventoryDetailsMap = new Map();
let tableBody = null;
let modalProductInstance = null;
let lastSearchToken = 0;

function q(selector) { return document.querySelector(selector); }
function qAll(selector) { return Array.from(document.querySelectorAll(selector)); }

async function apiGet(path) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${BASE_API_URL}${path}`, {
        method: 'GET',
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
        }
    });
    const text = await res.text().catch(() => null);
    if (!res.ok) {
        const err = new Error(`GET ${path} => ${res.status} - ${text ?? '<no body>'}`);
        err.status = res.status;
        err.body = text;
        throw err;
    }
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

async function apiPost(path, payload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${BASE_API_URL}${path}`, {
        method: 'POST',
        headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const text = await res.text().catch(() => null);
    if (!res.ok) {
        const err = new Error(`POST ${path} => ${res.status} - ${text ?? '<no body>'}`);
        err.status = res.status;
        err.body = text;
        throw err;
    }
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}

function extractInventarioId(obj) {
    if (obj == null) return null;
    if (typeof obj === 'number' && Number.isFinite(obj)) return obj;
    if (typeof obj === 'string' && /^\d+$/.test(obj.trim())) return Number(obj.trim());

    if (typeof obj === 'object') {
        const keys = ['idInventario','id_inventario','id','inventarioId','idInventarioResponse','idInventarioDTO','id_inventario_created'];
        for (const k of keys) {
            if (obj[k] != null) return obj[k];
        }
        if (obj.sucursal && (obj.sucursal.inventario != null)) return obj.sucursal.inventario;
        if (obj.inventario && (obj.inventario.idInventario || obj.inventario.id)) return obj.inventario.idInventario ?? obj.inventario.id;
        if (obj.data && (obj.data.idInventario ?? obj.data.id)) return obj.data.idInventario ?? obj.data.id;
        if (obj.result && (obj.result.idInventario ?? obj.result.id)) return obj.result.idInventario ?? obj.result.id;
    }
    return null;
}

function extractProductoId(obj) {
    if (obj == null) return null;
    if (typeof obj === 'number' && Number.isFinite(obj)) return obj;
    if (typeof obj === 'string' && /^\d+$/.test(obj.trim())) return Number(obj.trim());
    if (typeof obj === 'object') {
        const keys = ['idProducto','id_producto','id','productoId'];
        for (const k of keys) {
            if (obj[k] != null) return obj[k];
        }
        if (obj.data && (obj.data.idProducto ?? obj.data.id)) return obj.data.idProducto ?? obj.data.id;
        if (obj.result && (obj.result.idProducto ?? obj.result.id)) return obj.result.idProducto ?? obj.result.id;
    }
    return null;
}

function extractSucursalId(profile) {
    if (!profile) return null;
    if (profile.idSucursal) return profile.idSucursal;
    if (profile.id_sucursal) return profile.id_sucursal;
    if (profile.sucursalId) return profile.sucursalId;
    if (profile.sucursal && (profile.sucursal.idSucursal || profile.sucursal.id)) return profile.sucursal.idSucursal ?? profile.sucursal.id;
    if (profile.trabajador && (profile.trabajador.idSucursal || profile.trabajador.id_sucursal || profile.trabajador.sucursalId)) {
        return profile.trabajador.idSucursal ?? profile.trabajador.id_sucursal ?? profile.trabajador.sucursalId;
    }
    for (const key of Object.keys(profile)) {
        const k = key.toLowerCase();
        if (k.includes('sucursal') && typeof profile[key] === 'number') return profile[key];
    }
    return null;
}

async function ensureInventoryForSucursal(sucursalId) {
    if (!sucursalId) return null;
    console.debug('ensureInventoryForSucursal: start for sucursalId=', sucursalId);

    try {
        const inv = await apiGet(`/inventory/${sucursalId}`);
        console.debug('ensureInventoryForSucursal: GET /inventory/{sucursalId} returned:', inv);
        if (inv) return inv;
    } catch (err) {
        console.warn('ensureInventoryForSucursal: GET /inventory/{sucursalId} failed:', err.status, err.body);
    }

    try {
        const all = await apiGet('/inventory');
        console.debug('ensureInventoryForSucursal: GET /inventory returned:', all);
        const arr = Array.isArray(all) ? all : (all ? [all] : []);
        const found = arr.find(inv => {
            if (!inv) return false;
            if (inv.sucursal && (inv.sucursal.idSucursal == sucursalId || inv.sucursal.id == sucursalId)) return true;
            if (inv.idSucursal && inv.idSucursal == sucursalId) return true;
            if (inv.sucursalId && inv.sucursalId == sucursalId) return true;
            return false;
        });
        if (found) return found;
    } catch (err) {
        console.warn('ensureInventoryForSucursal: GET /inventory fallback failed:', err.status, err.body);
    }

    const payloadVariants = [
        { titulo: 'Inventario 1', descripcion: 'Inv', sucursal: { idSucursal: sucursalId } },
        { titulo: 'Inventario 1', descripcion: 'Inv', sucursal: { id: sucursalId } },
        { titulo: 'Inventario 1', descripcion: 'Inv', sucursalId: sucursalId },
        { titulo: 'Inventario 1', descripcion: 'Inv', idSucursal: sucursalId }
    ];
    for (const payload of payloadVariants) {
        try {
            console.debug('ensureInventoryForSucursal: trying POST /inventory payload:', payload);
            const created = await apiPost('/inventory', payload);
            console.debug('ensureInventoryForSucursal: POST /inventory returned:', created);
            try {
                const re = await apiGet(`/inventory/${sucursalId}`);
                console.debug('ensureInventoryForSucursal: re-fetched inventory after create:', re);
                if (re) return re;
            } catch (fetchErr) {
                console.warn('ensureInventoryForSucursal: re-fetch after create failed:', fetchErr.status, fetchErr.body);
            }
            if (created && typeof created === 'object') return created;
            const idExtracted = extractInventarioId(created);
            if (idExtracted) return { idInventario: idExtracted };
        } catch (postErr) {
            console.warn('ensureInventoryForSucursal: POST /inventory failed for payload', payload, postErr.status, postErr.body);
        }
    }

    try {
        const all2 = await apiGet('/inventory');
        const arr2 = Array.isArray(all2) ? all2 : (all2 ? [all2] : []);
        if (arr2.length > 0) return arr2[0];
    } catch (err) {
        console.warn('ensureInventoryForSucursal: final GET /inventory failed:', err.status, err.body);
    }

    notifyError('No se pudo obtener ni crear inventario para la sucursal. Revisa consola.');
    return null;
}

async function loadProductsAndDetails() {
    try {
        showLoadingTable(true);

        const profile = await getUserProfile().catch(() => null);
        const sucursalId = extractSucursalId(profile);
        if (!sucursalId) {
            products = [];
            inventoryDetailsMap.clear();
            renderProductsTable([]);
            return;
        }

        const inventario = await ensureInventoryForSucursal(sucursalId);
        const inventarioId = extractInventarioId(inventario);

        if (!inventarioId) {
            products = [];
            inventoryDetailsMap.clear();
            renderProductsTable([]);
            return;
        }

        let details = [];
        try {
            const res = await apiGet(`/inventoryDetails/inventario/${inventarioId}`);
            details = Array.isArray(res) ? res : (res ? [res] : []);
        } catch (err) {
            console.warn('No inventoryDetails:', err.status, err.body);
            details = [];
        }

        inventoryDetailsMap.clear();
        const productMap = new Map();

        details.forEach(d => {
            if (!d.producto) return;

            const pid = d.producto.idProducto ?? d.producto.id;
            if (!pid) return;

            if (!productMap.has(pid)) {
                productMap.set(pid, d.producto);
            }

            if (!inventoryDetailsMap.has(pid)) {
                inventoryDetailsMap.set(pid, []);
            }
            inventoryDetailsMap.get(pid).push(d);
        });

        products = Array.from(productMap.values());

        renderProductsTable(products);
    } catch (err) {
        console.error('loadProductsAndDetails error:', err);
        notifyError('No se pudieron cargar los productos del inventario');
    } finally {
        showLoadingTable(false);
    }
}


function computeAggregateForProduct(product) {
    const details = inventoryDetailsMap.get(product.idProducto) || [];
    let nombre = product.nombre;
    let totalCantidad = 0;
    let disponible = false;
    details.forEach(d => {
        const c = Number(d.cantidad) || 0;
        totalCantidad += c;
        if (d.disponible === true || d.disponible === 'true') disponible = true;
    });
    return { cantidad: totalCantidad, disponible, nombre};
}

function renderProductsTable(list) {
    if (!tableBody) tableBody = q('#productsTable tbody');
    tableBody.innerHTML = '';
    if (!list || list.length === 0) {
        q('#products-empty')?.classList.remove('d-none');
        return;
    } else {
        q('#products-empty')?.classList.add('d-none');
    }

    list.forEach(product => {
        const agg = computeAggregateForProduct(product);
        const tr = document.createElement('tr');
        tr.classList.add('product-row');
        tr.dataset.productId = product.idProducto;
        tr.innerHTML = `
            <td>${product.idProducto ?? ''}</td>
            <td>${agg.nombre}</td>
            <td>${agg.cantidad}</td>
            <td>${product.marca ?? ''}</td>
            <td>${product.modelo ?? ''}</td>
            <td>${agg.disponible ? 'Sí' : 'No'}</td>
            <td>${product.precio != null ? Number(product.precio).toFixed(2) : ''}</td>
        `;
        tr.addEventListener('click', () => openProductDetailsModal(product.idProducto));
        tableBody.appendChild(tr);
    });
}

function applyFiltersAndRender() {
    const qText = q('#inputSearch')?.value.trim().toLowerCase() || '';
    const category = q('#selectCategory')?.value || '';
    const status = q('#selectActivo')?.value || '';
    let filtered = products.slice();

    if (qText) {
        filtered = filtered.filter(p =>
            (p.nombre || '').toLowerCase().includes(qText) ||
            (p.modelo || '').toLowerCase().includes(qText) ||
            (String(p.idProducto) || '').includes(qText)
        );
    }

    if (category === 'activo') filtered = filtered.filter(p => p.activo === true || p.activo === 'true');
    else if (category === 'otros') filtered = filtered.filter(p => !(p.activo === true || p.activo === 'true'));

    if (status === 'Activo') filtered = filtered.filter(p => computeAggregateForProduct(p).disponible);
    else if (status === 'Desactivo') filtered = filtered.filter(p => !computeAggregateForProduct(p).disponible);

    renderProductsTable(filtered);
}

function showLoadingTable(loading) {
    const tb = q('#productsTable');
    if (!tb) return;
    if (loading) tb.classList.add('opacity-75');
    else tb.classList.remove('opacity-75');
}

async function openProductDetailsModal(productId) {
    const product = products.find(p => p.idProducto == productId);
    if (!product) return notifyError('Producto no encontrado.');

    let details = [];
    try {
        const d = await apiGet(`/inventoryDetails/producto/${productId}`);
        details = Array.isArray(d) ? d : (d ? [d] : []);
    } catch (err) {
        console.warn('openProductDetailsModal: error fetching details:', err.status, err.body);
        details = inventoryDetailsMap.get(productId) || [];
    }

    const existing = document.getElementById('modalProductDetails');
    if (existing) existing.remove();

    const modalHtml = document.createElement('div');
    modalHtml.className = 'modal fade';
    modalHtml.id = 'modalProductDetails';
    modalHtml.tabIndex = -1;
    modalHtml.setAttribute('aria-hidden', 'true');
    modalHtml.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Producto #${product.idProducto} — ${product.nombre}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                    <div class="row g-3">
                        <div class="col-12 col-md-6"><strong>Nombre:</strong> ${product.nombre ?? ''}</div>
                        <div class="col-12 col-md-6"><strong>Marca:</strong> ${product.marca ?? ''}</div>
                        <div class="col-12 col-md-6"><strong>Modelo:</strong> ${product.modelo ?? ''}</div>
                        <div class="col-12 col-md-6"><strong>IMEI:</strong> ${product.imei ?? ''}</div>
                        <div class="col-12 col-md-6"><strong>Precio:</strong> ${product.precio != null ? Number(product.precio).toFixed(2) : ''}</div>
                        <div class="col-12 col-md-6"><strong>Costo:</strong> ${product.costo != null ? Number(product.costo).toFixed(2) : ''}</div>
                        <div class="col-12"><strong>Descripción:</strong> ${product.descripcion ?? ''}</div>
                        <div class="col-12"><strong>Estado:</strong> ${details[0]?.estado ?? ''}</div>
                        <div class="col-12"><strong>Activo:</strong> ${product.activo ? 'Sí' : 'No'}</div>
                    </div>
                    <hr/>
                    <h6>Detalles en inventario</h6>
                    <div class="table-responsive">
                        <table class="table table-sm table-striped">
                             <thead>
                                 <tr>
                                     <th>ID Detalle</th>
                                     <th>ID Inventario</th>
                                     <th>Cantidad</th>
                                     <th>Estado</th>
                                     <th>Método de Pago</th>
                                     <th>Disponible</th>
                                 </tr>
                             </thead>
                            <tbody>
                                 ${(details.length === 0) ? `<tr><td colspan="7" class="text-center text-muted">No hay registros</td></tr>` :
                                     details.map(d => `
                                         <tr>
                                             <td>${d.idDetalle ?? ''}</td>
                                             <td>${d.inventario?.idInventario ?? (d.idInventario ?? '')}</td>
                                             <td>${d.cantidad ?? ''}</td>
                                             <td>${d.estado ?? ''}</td>
                                             <td>${d.metodoPago ?? ''}</td>
                                             <td>${d.disponible ? 'Sí' : 'No'}</td>
                                         </tr>
                                     `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="btnCloseDetails" type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalHtml);
    new bootstrap.Modal(modalHtml).show();
}

function debounce(fn, wait) {
    let t = null;
    return function(...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

async function performLiveSearch(query, tokenId) {
    try {
        if (!query || query.length < 2) {
            if (tokenId === lastSearchToken) renderProductsTable(products);
            return;
        }

        try {
            const serverResults = await apiGet(`/product/nombre?nombre=${encodeURIComponent(query)}`);
            let list = Array.isArray(serverResults) ? serverResults : (serverResults ? [serverResults] : []);
            if (!list || list.length === 0) {
                const qText = query.toLowerCase();
                list = products.filter(p => (p.nombre || '').toLowerCase().includes(qText) || (p.modelo || '').toLowerCase().includes(qText));
            } else {
                list.forEach(sr => {
                    const idx = products.findIndex(p => p.idProducto === sr.idProducto);
                    if (idx >= 0) products[idx] = sr;
                    else products.push(sr);
                });
            }

            if (tokenId === lastSearchToken) {
                const proms = list.map(async p => {
                    if (!inventoryDetailsMap.has(p.idProducto)) {
                        try {
                            const details = await apiGet(`/inventoryDetails/producto/${p.idProducto}`);
                            inventoryDetailsMap.set(p.idProducto, Array.isArray(details) ? details : (details ? [details] : []));
                        } catch (err) {
                            inventoryDetailsMap.set(p.idProducto, []);
                        }
                    }
                });
                await Promise.all(proms);
                renderProductsTable(list);
            }
        } catch (err) {
            console.warn('performLiveSearch: server search error:', err.status, err.body);
            const qText = query.toLowerCase();
            const filtered = products.filter(p => (p.nombre || '').toLowerCase().includes(qText) || (p.modelo || '').toLowerCase().includes(qText));
            if (tokenId === lastSearchToken) renderProductsTable(filtered);
        }
    } catch (e) {
        console.error('performLiveSearch error:', e);
    }
}

async function initProductModal() {
    const modalEl = q('#modalProduct');
    if (!modalEl) return;

    modalProductInstance = new bootstrap.Modal(modalEl);
    const form = q('#formProduct');
    if (!form) return;

    if (form._inventarioHandler) {
        try { form.removeEventListener('submit', form._inventarioHandler); } catch (e) {}
    }

    const handler = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const payloadProducto = {
            nombre: q('#inputNombre')?.value?.trim() || '',
            descripcion: q('#inputDescripcion')?.value?.trim() || '',
            marca: q('#inputMarca')?.value?.trim() || '',
            modelo: q('#inputModelo')?.value?.trim() || '',
            imei: q('#inputImei')?.value?.trim() || null,
            precio: q('#inputPrecio')?.value ? Number(q('#inputPrecio').value) : null,
            costo: q('#inputCosto')?.value ? Number(q('#inputCosto').value) : null,
            activo: q('#inputActivo')?.checked === true
        };

        if (!payloadProducto.nombre || !payloadProducto.descripcion || !payloadProducto.marca || !payloadProducto.modelo) {
            return notifyError('Llena los campos obligatorios del producto.');
        }

        const btn = q('#btnSubmitProduct');

        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Guardando...';
            }

            const created = await apiPost('/product', payloadProducto);
            notifySuccess('Producto creado correctamente.');

            const profile = await getUserProfile().catch(() => null);
            const sucursalId = extractSucursalId(profile);

            let inventarioObj = null;
            if (sucursalId) {
                inventarioObj = await ensureInventoryForSucursal(sucursalId);
            }

            const stockVal = Number(q('#inputStock')?.value || 0);
            let inventarioIdValue = extractInventarioId(inventarioObj);

            const productoIdValue =
                extractProductoId(created) ??
                created?.idProducto ??
                created?.id ??
                created?.id_producto ??
                null;

            const inventarioDetailPayload = {
                cantidad: stockVal,
                estado: q('#inputEstado')?.value?.trim() || 'Bueno',
                disponible: stockVal > 0,
                idInventario: inventarioIdValue,
                idProducto: productoIdValue,
                metodoPago: q('#inputMetodoPago')?.value?.trim() || null
            };

            if (inventarioIdValue && productoIdValue) {
                await apiPost('/inventoryDetails', inventarioDetailPayload);
                notifySuccess('InventarioDetails creado y ligado correctamente.');
            } else {
                notifyError('Producto creado pero no se pudo ligar al inventario.');
            }

            form.reset();
            modalProductInstance?.hide();
            await loadProductsAndDetails();

        } catch (err) {
            console.error(err);
            notifyError('No se pudo crear el producto.');
        } finally {
            await updateNewProductButton();
        }
    };

    form._inventarioHandler = handler;
    form.addEventListener('submit', handler);

    q('#btnOpenNewProduct')?.addEventListener('click', () => {
        q('#modalProductTitle').textContent = 'Nuevo producto';
        form.reset();
        modalProductInstance.show();
    });

    try {
        const profile = await getUserProfile().catch(() => null);
        const sucursalId = extractSucursalId(profile);
        const btn = q('#btnOpenNewProduct');

        if (!sucursalId) {
            btn.disabled = true;

            let msgEl = q('#noSucursalMessage');
            if (!msgEl) {
                msgEl = document.createElement('small');
                msgEl.id = 'noSucursalMessage';
                msgEl.className = 'text-danger d-block mt-1';
                msgEl.textContent = 'Debes tener una sucursal asignada para agregar productos.';
                btn.parentNode.insertBefore(msgEl, btn.nextSibling);
            } else {
                msgEl.style.display = 'block';
            }
        } else {
            btn.disabled = false;
            q('#noSucursalMessage')?.style && (q('#noSucursalMessage').style.display = 'none');
        }
    } catch (err) {
        console.warn('Error checking sucursal:', err);
    }
}

async function updateNewProductButton() {
    const btn = q('#btnOpenNewProduct');
    if (!btn) return;

    const profile = await getUserProfile().catch(() => null);
    const sucursalId = extractSucursalId(profile);

    if (!sucursalId) {
        btn.disabled = true;

        let msgEl = q('#noSucursalMessage');
        if (!msgEl) {
            msgEl = document.createElement('small');
            msgEl.id = 'noSucursalMessage';
            msgEl.className = 'text-danger d-block mt-1';
            msgEl.textContent = 'Debes tener una sucursal asignada para agregar productos.';
            btn.parentNode.insertBefore(msgEl, btn.nextSibling);
        } else {
            msgEl.style.display = 'block';
        }
    } else {
        btn.disabled = false;
        q('#noSucursalMessage')?.style && (q('#noSucursalMessage').style.display = 'none');
    }
}


function initFilters() {
    q('#btnRefreshProducts')?.addEventListener('click', () => loadProductsAndDetails());
    q('#selectCategory')?.addEventListener('change', applyFiltersAndRender);
    q('#selectActivo')?.addEventListener('change', applyFiltersAndRender);
    const doSearchDebounced = debounce((val, tokenId) => performLiveSearch(val, tokenId), 300);
    q('#inputSearch')?.addEventListener('input', (e) => {
        const v = e.target.value.trim();
        lastSearchToken = Math.random();
        doSearchDebounced(v, lastSearchToken);
    });
}

function initPage() {
    tableBody = q('#productsTable tbody');
    initFilters();
    initProductModal();
    loadProductsAndDetails();
}

document.addEventListener('DOMContentLoaded', initPage);
document.addEventListener('sucursalUpdated', async (e) => {
    const sucursalId = e.detail?.sucursalId;

    if (sucursalId) {
        console.info('Sucursal actualizada en inventario:', sucursalId);
        await updateNewProductButton();
        await loadProductsAndDetails();
    }
});