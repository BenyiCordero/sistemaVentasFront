// js/gastos.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

const GET_EXPENSES_ENDPOINT = `${BASE_API_URL}/expenses`;
const CREATE_EXPENSE_ENDPOINT = `${BASE_API_URL}/expenses`;
const UPDATE_EXPENSE_ENDPOINT = (id) => `${BASE_API_URL}/expenses/${id}`;
const DELETE_EXPENSE_ENDPOINT = (id) => `${BASE_API_URL}/expenses/${id}`;
const GET_EXPENSES_SUMMARY_ENDPOINT = `${BASE_API_URL}/expenses/summary`;

const expensesTableBody = () => document.querySelector('#expensesTable tbody');
const expensesEmpty = () => document.getElementById('expenses-empty');

let currentExpenses = [];
let modalInstance = null;
let editingExpenseId = null;

function getCategoryBadge(category) {
    const badges = {
        'alquiler': { text: 'Alquiler', class: 'primary' },
        'servicios': { text: 'Servicios', class: 'info' },
        'suministros': { text: 'Suministros', class: 'success' },
        'mantenimiento': { text: 'Mantenimiento', class: 'warning' },
        'marketing': { text: 'Marketing', class: 'danger' },
        'transporte': { text: 'Transporte', class: 'secondary' },
        'otros': { text: 'Otros', class: 'dark' }
    };
    const badge = badges[category] || { text: category, class: 'secondary' };
    return `<span class="badge bg-${badge.class}">${badge.text}</span>`;
}

function getPaymentMethodBadge(method) {
    const badges = {
        'efectivo': { text: 'Efectivo', class: 'success' },
        'tarjeta': { text: 'Tarjeta', class: 'primary' },
        'transferencia': { text: 'Transferencia', class: 'info' },
        'cheque': { text: 'Cheque', class: 'warning' }
    };
    const badge = badges[method] || { text: method, class: 'secondary' };
    return `<span class="badge bg-${badge.class}">${badge.text}</span>`;
}

function getStatusBadge(status) {
    const badges = {
        'pagado': { text: 'Pagado', class: 'success' },
        'pendiente': { text: 'Pendiente', class: 'warning' },
        'cancelado': { text: 'Cancelado', class: 'danger' }
    };
    const badge = badges[status] || { text: status, class: 'secondary' };
    return `<span class="badge bg-${badge.class}">${badge.text}</span>`;
}

function renderExpenseRow(expense) {
    const tr = document.createElement('tr');
    const fecha = new Date(expense.fecha || expense.createdAt || Date.now()).toLocaleDateString();
    
    tr.innerHTML = `
    <td>${expense.id ?? ''}</td>
    <td>${fecha}</td>
    <td>${expense.descripcion ?? ''}</td>
    <td>${getCategoryBadge(expense.categoria)}</td>
    <td class="text-end fw-bold text-danger">$${typeof expense.monto !== 'undefined' ? Number(expense.monto).toFixed(2) : '0.00'}</td>
    <td>${getPaymentMethodBadge(expense.metodoPago)}</td>
    <td>${getStatusBadge(expense.estado || 'pagado')}</td>
    <td>
        <button class="btn btn-sm btn-outline-primary btn-edit me-1" data-id="${expense.id}">
            <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${expense.id}">
            <i class="bi bi-trash"></i>
        </button>
    </td>
    `;
    return tr;
}

function renderExpensesTable(expenses) {
    const tbody = expensesTableBody();
    tbody.innerHTML = '';
    if (!expenses || expenses.length === 0) {
        expensesEmpty().classList.remove('d-none');
        return;
    }
    expensesEmpty().classList.add('d-none');
    expenses.forEach(expense => tbody.appendChild(renderExpenseRow(expense)));
}

function updateSummary(summary) {
    document.getElementById('gastos-hoy').textContent = `$${Number(summary.hoy || 0).toFixed(2)}`;
    document.getElementById('gastos-semana').textContent = `$${Number(summary.semana || 0).toFixed(2)}`;
    document.getElementById('gastos-mes').textContent = `$${Number(summary.mes || 0).toFixed(2)}`;
    document.getElementById('gastos-promedio').textContent = `$${Number(summary.promedio || 0).toFixed(2)}`;
}

function filterExpenses() {
    const searchTerm = document.getElementById('inputSearch').value.toLowerCase();
    const categoryFilter = document.getElementById('selectCategory').value;
    const dateFilter = document.getElementById('inputDateRange').value;

    let filtered = currentExpenses.filter(expense => {
        const matchesSearch = !searchTerm || 
            (expense.descripcion?.toLowerCase().includes(searchTerm)) ||
            (expense.proveedor?.toLowerCase().includes(searchTerm)) ||
            (expense.factura?.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !categoryFilter || expense.categoria === categoryFilter;
        
        const expenseDate = new Date(expense.fecha || expense.createdAt || Date.now());
        const matchesDate = !dateFilter || expenseDate.toISOString().substring(0, 10) === dateFilter;

        return matchesSearch && matchesCategory && matchesDate;
    });

    renderExpensesTable(filtered);
}

async function fetchExpenses(filters = {}) {
    const token = localStorage.getItem('authToken');
    const queryParams = new URLSearchParams(filters).toString();
    const url = `${GET_EXPENSES_ENDPOINT}${queryParams ? '?' + queryParams : ''}`;
    
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
    return Array.isArray(data) ? data : (data?.expenses ?? data?.data ?? []);
}

async function fetchExpensesSummary() {
    const token = localStorage.getItem('authToken');
    const res = await fetch(GET_EXPENSES_SUMMARY_ENDPOINT, {
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
    return await res.json();
}

async function createExpense(expensePayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(CREATE_EXPENSE_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(expensePayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function updateExpense(id, expensePayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(UPDATE_EXPENSE_ENDPOINT(id), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(expensePayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function deleteExpense(id) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(DELETE_EXPENSE_ENDPOINT(id), {
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
    const modalEl = document.getElementById('modalExpense');
    modalInstance = new bootstrap.Modal(modalEl);

    document.getElementById('btnOpenNewExpense').addEventListener('click', () => {
        editingExpenseId = null;
        document.getElementById('modalExpenseTitle').textContent = 'Nuevo gasto';
        document.getElementById('formExpense').reset();
        const hoy = new Date().toISOString().substring(0, 10);
        document.getElementById('inputFecha').value = hoy;
        modalInstance.show();
    });

    document.getElementById('formExpense').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            descripcion: document.getElementById('inputDescripcion').value.trim(),
            categoria: document.getElementById('selectCategoria').value,
            monto: Number(document.getElementById('inputMonto').value || 0),
            fecha: document.getElementById('inputFecha').value,
            metodoPago: document.getElementById('selectMetodoPago').value,
            proveedor: document.getElementById('inputProveedor').value.trim(),
            factura: document.getElementById('inputFactura').value.trim(),
            notas: document.getElementById('inputNotas').value.trim()
        };

        try {
            const btn = document.getElementById('btnSubmitExpense');
            btn.disabled = true;
            btn.textContent = editingExpenseId ? 'Actualizando...' : 'Guardando...';

            if (editingExpenseId) {
                await updateExpense(editingExpenseId, payload);
                displayMessage && displayMessage('Gasto actualizado correctamente.');
            } else {
                await createExpense(payload);
                displayMessage && displayMessage('Gasto creado correctamente.');
            }

            modalInstance.hide();
            await loadExpenses();
        } catch (err) {
            console.error('saveExpense error', err);
            displayError(`No se pudo guardar el gasto: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitExpense');
            btn.disabled = false;
            btn.textContent = 'Guardar gasto';
        }
    });
}

function initTableHandlers() {
    document.getElementById('btnRefreshExpenses').addEventListener('click', () => {
        loadExpenses();
    });

    document.getElementById('btnFilter').addEventListener('click', () => {
        filterExpenses();
    });

    document.getElementById('inputSearch').addEventListener('input', () => {
        filterExpenses();
    });

    document.getElementById('selectCategory').addEventListener('change', () => {
        filterExpenses();
    });

    document.getElementById('inputDateRange').addEventListener('change', () => {
        filterExpenses();
    });

    document.querySelector('#expensesTable tbody').addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        const btnDelete = e.target.closest('.btn-delete');

        if (btnEdit) {
            const id = btnEdit.getAttribute('data-id');
            const expense = currentExpenses.find(exp => exp.id == id);
            if (expense) {
                editingExpenseId = id;
                document.getElementById('modalExpenseTitle').textContent = 'Editar gasto';
                document.getElementById('inputDescripcion').value = expense.descripcion || '';
                document.getElementById('selectCategoria').value = expense.categoria || '';
                document.getElementById('inputMonto').value = expense.monto || 0;
                document.getElementById('inputFecha').value = expense.fecha || new Date().toISOString().substring(0, 10);
                document.getElementById('selectMetodoPago').value = expense.metodoPago || '';
                document.getElementById('inputProveedor').value = expense.proveedor || '';
                document.getElementById('inputFactura').value = expense.factura || '';
                document.getElementById('inputNotas').value = expense.notas || '';
                modalInstance.show();
            }
        }

        if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            if (confirm('¿Estás seguro de que deseas eliminar este gasto?')) {
                try {
                    await deleteExpense(id);
                    displayMessage && displayMessage('Gasto eliminado correctamente.');
                    await loadExpenses();
                } catch (err) {
                    console.error('deleteExpense error', err);
                    displayError(`No se pudo eliminar el gasto: ${err.message || err}`);
                }
            }
        }
    });
}

async function loadExpenses() {
    try {
        const [expenses, summary] = await Promise.all([
            fetchExpenses(),
            fetchExpensesSummary()
        ]);

        currentExpenses = expenses;
        updateSummary(summary);
        filterExpenses();
    } catch (err) {
        console.error('loadExpenses error', err);
        displayError(`Error cargando gastos: ${err.message || err}`);
        renderExpensesTable([]);
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
        await loadExpenses();
    } catch (err) {
        console.error('init gastos error', err);
        displayError('Error inicializando módulo de gastos.');
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);