// js/reportes.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://localhost:8081';

const GET_REPORTS_ENDPOINT = `${BASE_API_URL}/sell`;
const GENERATE_REPORT_ENDPOINT = `${BASE_API_URL}/sell`;
const GET_METRICS_ENDPOINT = `${BASE_API_URL}/sell`;

const reportsTableBody = () => document.querySelector('#reportsTable tbody');
const reportsEmpty = () => document.getElementById('reports-empty');

let currentReports = [];
let modalInstance = null;
let evolutionChart = null;
let distributionChart = null;

function getTransactionTypeIcon(type) {
    const icons = {
        'venta': '<i class="bi bi-cart-plus text-success"></i>',
        'gasto': '<i class="bi bi-cash-stack text-danger"></i>',
        'inventario': '<i class="bi bi-boxes text-info"></i>',
        'general': '<i class="bi bi-file-earmark-text text-primary"></i>'
    };
    return icons[type] || '<i class="bi bi-receipt text-secondary"></i>';
}

function getTransactionTypeBadge(type) {
    const badges = {
        'venta': 'success',
        'gasto': 'danger',
        'inventario': 'info',
        'general': 'primary'
    };
    return badges[type] || 'secondary';
}

function renderReportRow(report) {
    const tr = document.createElement('tr');
    const fecha = new Date(report.fecha || report.createdAt || Date.now()).toLocaleDateString();
    
    tr.innerHTML = `
    <td>${fecha}</td>
    <td>${getTransactionTypeIcon(report.tipo)} ${report.tipo || ''}</td>
    <td>${report.descripcion || report.concepto || ''}</td>
    <td><span class="badge bg-secondary">${report.categoria || 'General'}</span></td>
    <td class="text-end fw-bold">
        ${report.tipo === 'gasto' ? '-' : '+'}$${typeof report.monto !== 'undefined' ? Number(report.monto).toFixed(2) : '0.00'}
    </td>
    <td><span class="badge bg-${getTransactionTypeBadge(report.tipo)}">${report.estado || 'Completado'}</span></td>
    `;
    return tr;
}

function renderReportsTable(reports) {
    const tbody = reportsTableBody();
    tbody.innerHTML = '';
    if (!reports || reports.length === 0) {
        reportsEmpty().classList.remove('d-none');
        return;
    }
    reportsEmpty().classList.add('d-none');
    reports.forEach(report => tbody.appendChild(renderReportRow(report)));
}

function updateMetrics(metrics) {
    document.getElementById('total-ingresos').textContent = `$${Number(metrics.totalIngresos || 0).toFixed(2)}`;
    document.getElementById('total-gastos').textContent = `$${Number(metrics.totalGastos || 0).toFixed(2)}`;
    document.getElementById('total-balance').textContent = `$${Number(metrics.balance || 0).toFixed(2)}`;
    document.getElementById('total-transacciones').textContent = metrics.totalTransacciones || 0;
}

function initCharts() {
    // Destruir charts existentes para evitar duplicación
    if (evolutionChart) {
        evolutionChart.destroy();
        evolutionChart = null;
    }
    if (distributionChart) {
        distributionChart.destroy();
        distributionChart = null;
    }

    // Gráfico de evolución - inicializado sin datos
    const evolutionCtx = document.getElementById('chartEvolution').getContext('2d');
    evolutionChart = new Chart(evolutionCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Ingresos',
                data: [],
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1
            }, {
                label: 'Gastos',
                data: [],
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Gráfico de distribución - inicializado sin datos
    const distributionCtx = document.getElementById('chartDistribution').getContext('2d');
    distributionChart = new Chart(distributionCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });
}

    // Gráfico de distribución
    const distributionCtx = document.getElementById('chartDistribution').getContext('2d');
    distributionChart = new Chart(distributionCtx, {
        type: 'doughnut',
        data: {
            labels: ['Ventas', 'Gastos', 'Inventario', 'Otros'],
            datasets: [{
                data: [45, 25, 20, 10],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                }
            }
        }
    });

function updateCharts(metrics) {
    if (!metrics) return;

    // Actualizar gráfico de evolución con datos reales de la API
    if (evolutionChart && metrics.evolution) {
        evolutionChart.data.labels = metrics.evolution.labels || [];
        evolutionChart.data.datasets[0].data = metrics.evolution.ingresos || [];
        evolutionChart.data.datasets[1].data = metrics.evolution.gastos || [];
        evolutionChart.update();
    }

    // Actualizar gráfico de distribución con datos reales de la API
    if (distributionChart && metrics.distribution) {
        distributionChart.data.labels = metrics.distribution.labels || [];
        distributionChart.data.datasets[0].data = metrics.distribution.values || [];
        distributionChart.update();
    }
}

function showChartsLoading() {
    if (evolutionChart) {
        evolutionChart.data.labels = ['Cargando...'];
        evolutionChart.data.datasets[0].data = [0];
        evolutionChart.data.datasets[1].data = [0];
        evolutionChart.update();
    }

    if (distributionChart) {
        distributionChart.data.labels = ['Cargando...'];
        distributionChart.data.datasets[0].data = [1];
        distributionChart.update();
    }
}

function showChartsError() {
    if (evolutionChart) {
        evolutionChart.data.labels = ['Error'];
        evolutionChart.data.datasets[0].data = [0];
        evolutionChart.data.datasets[1].data = [0];
        evolutionChart.update();
    }

    if (distributionChart) {
        distributionChart.data.labels = ['Sin datos'];
        distributionChart.data.datasets[0].data = [1];
        distributionChart.update();
    }
}

function filterReports() {
    const reportType = document.getElementById('selectReportType').value;
    const startDate = document.getElementById('inputStartDate').value;
    const endDate = document.getElementById('inputEndDate').value;

    let filtered = currentReports.filter(report => {
        const matchesType = !reportType || report.tipo === reportType;
        
        const reportDate = new Date(report.fecha || report.createdAt || Date.now());
        const matchesStartDate = !startDate || reportDate >= new Date(startDate);
        const matchesEndDate = !endDate || reportDate <= new Date(endDate);

        return matchesType && matchesStartDate && matchesEndDate;
    });

    renderReportsTable(filtered);
}

async function fetchReports(filters = {}) {
    const token = localStorage.getItem('authToken');
    const url = `${GET_REPORTS_ENDPOINT}`;
    
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

async function fetchMetrics(filters = {}) {
    const token = localStorage.getItem('authToken');
    const url = `${GET_METRICS_ENDPOINT}`;
    
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
    
    // Calcular métricas desde los datos de ventas
    const ventas = Array.isArray(data) ? data : (data?.ventas ?? data?.data ?? []);
    const totalIngresos = ventas.reduce((sum, venta) => sum + (venta.total || 0), 0);
    const totalGastos = 0; // No hay endpoint de gastos, se puede implementar después
    const balance = totalIngresos - totalGastos;
    
    return {
        totalIngresos,
        totalGastos,
        balance,
        totalTransacciones: ventas.length,
        evolution: {
            labels: ventas.slice(-7).map(v => new Date(v.fecha).toLocaleDateString()),
            ingresos: ventas.slice(-7).map(v => v.total || 0),
            gastos: [0, 0, 0, 0, 0, 0, 0] // Placeholder para gastos
        },
        distribution: {
            labels: ['Ventas', 'Otros'],
            values: [totalIngresos, 0]
        }
    };
}

async function generateReport(reportPayload) {
    // Generar reporte CSV simple desde los datos de ventas
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${BASE_API_URL}/sell`, {
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
    const ventas = Array.isArray(data) ? data : (data?.ventas ?? data?.data ?? []);
    
    // Generar CSV
    let csv = 'ID,Fecha,Cliente,Total,Estado\n';
    ventas.forEach(venta => {
        csv += `${venta.id},${new Date(venta.fecha).toLocaleDateString()},${venta.cliente || 'N/A'},${venta.total || 0},${venta.estado || 'Completado'}\n`;
    });
    
    // Descargar el archivo
    const blob = new Blob([csv], { type: 'text/csv' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `reporte_ventas_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
    
    return true;
}

function initModalLogic() {
    const modalEl = document.getElementById('modalGenerateReport');
    modalInstance = new bootstrap.Modal(modalEl);

    document.getElementById('btnOpenNewProduct').addEventListener('click', () => {
        const hoy = new Date().toISOString().substring(0, 10);
        document.getElementById('inputFechaInicio').value = hoy;
        document.getElementById('inputFechaFin').value = hoy;
        document.getElementById('formGenerateReport').reset();
        modalInstance.show();
    });

    document.getElementById('formGenerateReport').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            tipoReporte: document.getElementById('selectTipoReporte').value,
            formato: document.getElementById('selectFormato').value,
            fechaInicio: document.getElementById('inputFechaInicio').value,
            fechaFin: document.getElementById('inputFechaFin').value,
            descripcion: document.getElementById('inputDescripcionReporte').value.trim()
        };

        try {
            const btn = document.getElementById('btnSubmitReport');
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Generando...';

            await generateReport(payload);
            displayMessage && displayMessage('Reporte generado y descargado correctamente.');
            modalInstance.hide();
        } catch (err) {
            console.error('generateReport error', err);
            displayError(`No se pudo generar el reporte: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitReport');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-download"></i> Generar y descargar';
        }
    });
}

function initHandlers() {
    document.getElementById('btnRefreshReports').addEventListener('click', () => {
        loadReports();
    });

    document.getElementById('btnApplyFilters').addEventListener('click', () => {
        filterReports();
    });

    document.getElementById('selectReportType').addEventListener('change', () => {
        filterReports();
    });

    document.getElementById('inputStartDate').addEventListener('change', () => {
        filterReports();
    });

    document.getElementById('inputEndDate').addEventListener('change', () => {
        filterReports();
    });

    document.getElementById('btnGenerateReport').addEventListener('click', () => {
        const hoy = new Date().toISOString().substring(0, 10);
        document.getElementById('inputFechaInicio').value = hoy;
        document.getElementById('inputFechaFin').value = hoy;
        document.getElementById('formGenerateReport').reset();
        modalInstance.show();
    });
}

async function loadReports() {
    try {
        // Mostrar estado de carga en los charts
        showChartsLoading();

        const filters = {
            tipo: document.getElementById('selectReportType').value,
            startDate: document.getElementById('inputStartDate').value,
            endDate: document.getElementById('inputEndDate').value
        };

        const [reports, metrics] = await Promise.all([
            fetchReports(filters),
            fetchMetrics(filters)
        ]);

        currentReports = reports;
        updateMetrics(metrics);
        renderReportsTable(reports);

        // Actualizar gráficos con datos reales de la API
        updateCharts(metrics);
    } catch (err) {
        console.error('loadReports error', err);
        displayError(`Error cargando reportes: ${err.message || err}`);
        renderReportsTable([]);
        showChartsError();
    }
}

async function init() {
    try {
        await getUserProfile().catch(err => {
            console.warn('getUserProfile falló: ', err);
            return null;
        });

        // Inicializar charts una sola vez
        initCharts();
        initModalLogic();
        initHandlers();

        // Establecer fechas por defecto
        const hoy = new Date();
        const haceUnMes = new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate());
        document.getElementById('inputStartDate').value = haceUnMes.toISOString().substring(0, 10);
        document.getElementById('inputEndDate').value = hoy.toISOString().substring(0, 10);

        // Cargar datos iniciales
        await loadReports();
    } catch (err) {
        console.error('init reportes error', err);
        displayError('Error inicializando módulo de reportes.');
        showChartsError();
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);