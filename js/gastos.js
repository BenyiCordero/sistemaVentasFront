// js/gastos.js
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://localhost:8081';
const token = localStorage.getItem('authToken');

const GASTO_API = `${BASE_API_URL}/gasto`;
const TOTAL_HOY = (id) => `${GASTO_API}/total/hoy/${id}`;
const TOTAL_SEMANA = (id) => `${GASTO_API}/total/semana/${id}`;
const TOTAL_MES = (id) => `${GASTO_API}/total/mes/${id}`;
const PROMEDIO_DIARIO = (id) => `${GASTO_API}/promedio/diario/${id}`;

const tableBody = document.querySelector('#expensesTable tbody');
const emptyState = document.getElementById('expenses-empty');

const gastosHoyEl = document.getElementById('gastos-hoy');
const gastosSemanaEl = document.getElementById('gastos-semana');
const gastosMesEl = document.getElementById('gastos-mes');
const gastosPromedioEl = document.getElementById('gastos-promedio');

const btnNuevo = document.getElementById('btnOpenNewExpense');
const btnRefresh = document.getElementById('btnRefreshExpenses');
const btnFilter = document.getElementById('btnFilter');

const searchInput = document.getElementById('inputSearch');
const categorySelect = document.getElementById('selectCategory');
const dateInput = document.getElementById('inputDateRange');

const modalEl = document.getElementById('modalExpense');
const modal = new bootstrap.Modal(modalEl);
const form = document.getElementById('formExpense');
const modalTitle = document.getElementById('modalExpenseTitle');

let gastos = [];
let editingId = null;
let profile = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!token || !token.includes('.')) {
        console.error('Token inválido');
        return;
    }

    profile = await getUserProfile();
    await cargarTotales();
    await cargarGastos();
});

async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: options.body
    });

    if (!res.ok) {
        throw new Error('Error en API');
    }

    return res.status === 204 ? null : res.json();
}

async function cargarTotales() {
    const idSucursal = profile.idSucursal;

    const [hoy, semana, mes, promedio] = await Promise.all([
        apiFetch(TOTAL_HOY(idSucursal)),
        apiFetch(TOTAL_SEMANA(idSucursal)),
        apiFetch(TOTAL_MES(idSucursal)),
        apiFetch(PROMEDIO_DIARIO(idSucursal))
    ]);

    gastosHoyEl.textContent = `$${(hoy || 0).toFixed(2)}`;
    gastosSemanaEl.textContent = `$${(semana || 0).toFixed(2)}`;
    gastosMesEl.textContent = `$${(mes || 0).toFixed(2)}`;
    gastosPromedioEl.textContent = `$${(promedio || 0).toFixed(2)}`;
}

async function cargarGastos() {
    gastos = await apiFetch(GASTO_API);
    renderTabla(gastos);
}

function renderTabla(data) {
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        emptyState.classList.remove('d-none');
        return;
    }

    emptyState.classList.add('d-none');

    data.forEach(g => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${g.idGasto}</td>
            <td>${formatFecha(g.fecha)}</td>
            <td>${g.descripcion}</td>
            <td>${g.tipoGasto}</td>
            <td class="fw-bold text-danger">$${g.monto.toFixed(2)}</td>
            <td>${g.metodoPago}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1" data-edit="${g.idGasto}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" data-delete="${g.idGasto}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

btnFilter.addEventListener('click', () => {
    let filtered = [...gastos];

    const text = searchInput.value.toLowerCase();
    const category = categorySelect.value;
    const date = dateInput.value;

    if (text) {
        filtered = filtered.filter(g =>
            g.descripcion.toLowerCase().includes(text) ||
            g.tipoGasto.toLowerCase().includes(text)
        );
    }

    if (category) {
        filtered = filtered.filter(g => g.tipoGasto === category);
    }

    if (date) {
        filtered = filtered.filter(g => g.fecha.startsWith(date));
    }

    renderTabla(filtered);
});

btnNuevo.addEventListener('click', () => {
    editingId = null;
    modalTitle.textContent = 'Nuevo gasto';
    form.reset();
    modal.show();
});

tableBody.addEventListener('click', (e) => {
    const editId = e.target.closest('[data-edit]')?.dataset.edit;
    const deleteId = e.target.closest('[data-delete]')?.dataset.delete;

    if (editId) abrirEditar(editId);
    if (deleteId) eliminar(deleteId);
});

async function abrirEditar(id) {
    const gasto = await apiFetch(`${GASTO_API}/${id}`);

    editingId = id;
    modalTitle.textContent = 'Editar gasto';

    form.inputDescripcion.value = gasto.descripcion;
    form.selectCategoria.value = gasto.tipoGasto;
    form.inputMonto.value = gasto.monto;
    form.inputFecha.value = gasto.fecha.split('T')[0];
    form.selectMetodoPago.value = gasto.metodoPago;
    form.inputProveedor.value = gasto.proveedor || '';
    form.inputFactura.value = gasto.factura || '';
    form.inputNotas.value = gasto.notas || '';

    modal.show();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
        descripcion: form.inputDescripcion.value,
        tipoGasto: form.selectCategoria.value,
        monto: parseFloat(form.inputMonto.value),
        fecha: `${form.inputFecha.value}T00:00:00`,
        metodoPago: form.selectMetodoPago.value,
        proveedor: form.inputProveedor.value,
        factura: form.inputFactura.value,
        notas: form.inputNotas.value,
        idSucursal: profile.idSucursal
    };

    if (editingId) {
        await apiFetch(`${GASTO_API}/${editingId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    } else {
        await apiFetch(GASTO_API, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    modal.hide();
    await cargarTotales();
    await cargarGastos();
});

async function eliminar(id) {
    if (!confirm('¿Eliminar este gasto?')) return;

    await apiFetch(`${GASTO_API}/${id}`, {
        method: 'DELETE'
    });

    await cargarTotales();
    await cargarGastos();
}

btnRefresh.addEventListener('click', async () => {
    await cargarTotales();
    await cargarGastos();
});

function formatFecha(fecha) {
    return new Date(fecha).toLocaleDateString('es-MX');
}