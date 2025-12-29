// js/reportes.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://localhost:8081/api';

const GET_REPORTS_ENDPOINT = `${BASE_API_URL}/sell`;
const GENERATE_REPORT_ENDPOINT = `${BASE_API_URL}/sell`;
const GET_METRICS_ENDPOINT = `${BASE_API_URL}/sell`;

let currentTab = 'ventas';
let currentReports = [];
let modalInstance = null;
let evolutionCharts = {};
let distributionCharts = {};

const tabConfigs = {
  ventas: {
    endpoint: 'http://localhost:8081/api/sell',
    metricsIds: ['total-ingresos-ventas', 'numero-ventas-ventas', 'promedio-ventas-ventas', 'producto-top-ventas'],
    tableId: 'reportsTableVentas',
    emptyId: 'reports-empty-ventas',
    chartEvolutionId: 'chartEvolutionVentas',
    chartDistributionId: 'chartDistributionVentas'
  },
  gastos: {
    endpoint: 'http://localhost:8081/api/gasto',
    metricsIds: ['total-gastos-gastos', 'numero-gastos-gastos', 'promedio-gastos-gastos', 'categoria-principal-gastos'],
    tableId: 'reportsTableGastos',
    emptyId: 'reports-empty-gastos',
    chartEvolutionId: 'chartEvolutionGastos',
    chartDistributionId: 'chartDistributionGastos'
  },
  inventario: {
    endpoint: 'http://localhost:8081/api/inventoryDetails',
    metricsIds: ['total-productos-inventario', 'stock-bajo-inventario', 'valor-inventario', 'productos-activos-inventario'],
    tableId: 'reportsTableInventario',
    emptyId: 'reports-empty-inventario',
    chartEvolutionId: 'chartEvolutionInventario',
    chartDistributionId: 'chartDistributionInventario'
  },
  financieros: {
    endpoint: 'http://localhost:8081/api/sell', // placeholder
    metricsIds: ['ingresos-totales-financieros', 'gastos-totales-financieros', 'ganancias-financieros', 'margen-financieros'],
    tableId: 'reportsTableFinancieros',
    emptyId: 'reports-empty-financieros',
    chartEvolutionId: 'chartEvolutionFinancieros',
    chartDistributionId: 'chartDistributionFinancieros'
  },
  clientes: {
    endpoint: 'http://localhost:8081/api/client',
    metricsIds: ['total-clientes-clientes', 'clientes-activos-clientes', 'creditos-pendientes-clientes', 'compra-promedio-clientes'],
    tableId: 'reportsTableClientes',
    emptyId: 'reports-empty-clientes',
    chartEvolutionId: 'chartEvolutionClientes',
    chartDistributionId: 'chartDistributionClientes'
  },
  usuarios: {
    endpoint: 'http://localhost:8081/api/worker',
    metricsIds: ['total-usuarios-usuarios', 'ventas-totales-usuarios', 'promedio-usuario-usuarios', 'usuario-top-usuarios'],
    tableId: 'reportsTableUsuarios',
    emptyId: 'reports-empty-usuarios',
    chartEvolutionId: 'chartEvolutionUsuarios',
    chartDistributionId: 'chartDistributionUsuarios'
  }
};

function renderReportRow(report) {
    const tr = document.createElement('tr');
    const fecha = new Date(report.fecha || report.createdAt || Date.now()).toLocaleDateString();

    if (currentTab === 'ventas') {
        const cliente = report.cliente || {};
        const producto = report.details && report.details.length > 0 ? report.details[0].producto : {};
        tr.innerHTML = `
        <td>${report.idVenta || report.id || ''}</td>
        <td>${fecha}</td>
        <td>${cliente.nombre || 'N/A'}</td>
        <td>${producto.nombre || 'N/A'}</td>
        <td>${report.details && report.details.length > 0 ? report.details[0].cantidad : ''}</td>
        <td>$${Number(report.totalVenta || report.total || 0).toFixed(2)}</td>
        <td><span class="badge bg-success">${report.estado || 'Completado'}</span></td>
        `;
    } else if (currentTab === 'gastos') {
        tr.innerHTML = `
        <td>${fecha}</td>
        <td>${report.descripcion || ''}</td>
        <td>${report.tipoGasto || ''}</td>
        <td>$${Number(report.monto || 0).toFixed(2)}</td>
        <td>${report.metodoPago || ''}</td>
        `;
    } else if (currentTab === 'inventario') {
        tr.innerHTML = `
        <td>${report.producto?.nombre || ''}</td>
        <td>${report.cantidad || 0}</td>
        <td>${report.estado || ''}</td>
        <td>$${Number(report.producto?.precio || 0).toFixed(2)}</td>
        <td>${fecha}</td>
        `;
    } else if (currentTab === 'financieros') {
        tr.innerHTML = `
        <td>${fecha}</td>
        <td>$${Number(report.ingresos || 0).toFixed(2)}</td>
        <td>$${Number(report.gastos || 0).toFixed(2)}</td>
        <td>$${Number((report.ingresos || 0) - (report.gastos || 0)).toFixed(2)}</td>
        <td>${report.ingresos ? (((report.ingresos - (report.gastos || 0)) / report.ingresos) * 100).toFixed(2) : 0}%</td>
        `;
    } else if (currentTab === 'clientes') {
        tr.innerHTML = `
        <td>${report.nombre || ''}</td>
        <td>$${Number(report.totalCompras || 0).toFixed(2)}</td>
        <td>${report.ultimaCompra ? new Date(report.ultimaCompra).toLocaleDateString() : ''}</td>
        <td>${report.creditoActivo ? 'Activo' : 'Inactivo'}</td>
        <td>$${Number(report.saldoPendiente || 0).toFixed(2)}</td>
        `;
    } else if (currentTab === 'usuarios') {
        tr.innerHTML = `
        <td>${report.nombre || ''}</td>
        <td>${report.rol || ''}</td>
        <td>${report.ventasRealizadas || 0}</td>
        <td>$${Number(report.totalVendido || 0).toFixed(2)}</td>
        <td>${report.ultimaVenta ? new Date(report.ultimaVenta).toLocaleDateString() : ''}</td>
        `;
    }
    return tr;
}

function renderReportsTable(reports) {
    const config = tabConfigs[currentTab];
    const tbody = document.querySelector('#' + config.tableId + ' tbody');
    tbody.innerHTML = '';
    if (!reports || reports.length === 0) {
        document.getElementById(config.emptyId).classList.remove('d-none');
        return;
    }
    document.getElementById(config.emptyId).classList.add('d-none');
    reports.forEach(report => tbody.appendChild(renderReportRow(report)));
}

function updateMetrics(metrics) {
    const config = tabConfigs[currentTab];
    config.metricsIds.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el) {
            if (currentTab === 'ventas') {
                const values = [
                    `$${Number(metrics.totalIngresos || 0).toFixed(2)}`,
                    metrics.numeroVentas || 0,
                    `$${Number(metrics.promedioVenta || 0).toFixed(2)}`,
                    metrics.productoTop || 'N/A'
                ];
                el.textContent = values[index];
            } else if (currentTab === 'gastos') {
                const values = [
                    `$${Number(metrics.totalGastos || 0).toFixed(2)}`,
                    metrics.numeroGastos || 0,
                    `$${Number(metrics.promedioGasto || 0).toFixed(2)}`,
                    metrics.categoriaPrincipal || 'N/A'
                ];
                el.textContent = values[index];
            } else if (currentTab === 'inventario') {
                const values = [
                    metrics.totalProductos || 0,
                    metrics.stockBajo || 0,
                    `$${Number(metrics.valorInventario || 0).toFixed(2)}`,
                    metrics.productosActivos || 0
                ];
                el.textContent = values[index];
            } else if (currentTab === 'financieros') {
                const values = [
                    `$${Number(metrics.ingresosTotales || 0).toFixed(2)}`,
                    `$${Number(metrics.gastosTotales || 0).toFixed(2)}`,
                    `$${Number(metrics.ganancias || 0).toFixed(2)}`,
                    `${metrics.margen || 0}%`
                ];
                el.textContent = values[index];
            } else if (currentTab === 'clientes') {
                const values = [
                    metrics.totalClientes || 0,
                    metrics.clientesActivos || 0,
                    `$${Number(metrics.creditosPendientes || 0).toFixed(2)}`,
                    `$${Number(metrics.compraPromedio || 0).toFixed(2)}`
                ];
                el.textContent = values[index];
            } else if (currentTab === 'usuarios') {
                const values = [
                    metrics.totalUsuarios || 0,
                    `$${Number(metrics.ventasTotales || 0).toFixed(2)}`,
                    `$${Number(metrics.promedioUsuario || 0).toFixed(2)}`,
                    metrics.usuarioTop || 'N/A'
                ];
                el.textContent = values[index];
            }
        }
    });
}

function initCharts() {
    ['ventas', 'gastos', 'inventario', 'financieros', 'clientes', 'usuarios'].forEach(tab => {
        const tabCap = tab.charAt(0).toUpperCase() + tab.slice(1);
        const evolutionCtx = document.getElementById('chartEvolution' + tabCap).getContext('2d');
        evolutionCharts[tab] = new Chart(evolutionCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Valores',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
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

        const distributionCtx = document.getElementById('chartDistribution' + tabCap).getContext('2d');
        distributionCharts[tab] = new Chart(distributionCtx, {
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

    const evolutionChart = evolutionCharts[currentTab];
    const distributionChart = distributionCharts[currentTab];

    // Actualizar gráfico de evolución
    if (evolutionChart && metrics.evolution) {
        evolutionChart.data.labels = metrics.evolution.labels || [];
        evolutionChart.data.datasets[0].data = metrics.evolution.values || [];
        evolutionChart.update();
    }

    // Actualizar gráfico de distribución
    if (distributionChart && metrics.distribution) {
        distributionChart.data.labels = metrics.distribution.labels || [];
        distributionChart.data.datasets[0].data = metrics.distribution.values || [];
        distributionChart.update();
    }
}

function showChartsLoading() {
    const evolutionChart = evolutionCharts[currentTab];
    const distributionChart = distributionCharts[currentTab];

    if (evolutionChart) {
        evolutionChart.data.labels = ['Cargando...'];
        evolutionChart.data.datasets[0].data = [0];
        evolutionChart.update();
    }

    if (distributionChart) {
        distributionChart.data.labels = ['Cargando...'];
        distributionChart.data.datasets[0].data = [1];
        distributionChart.update();
    }
}

function showChartsError() {
    const evolutionChart = evolutionCharts[currentTab];
    const distributionChart = distributionCharts[currentTab];

    if (evolutionChart) {
        evolutionChart.data.labels = ['Error'];
        evolutionChart.data.datasets[0].data = [0];
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
    const config = tabConfigs[currentTab];
    const token = localStorage.getItem('authToken');
    const url = `${config.endpoint}`;
    
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
    return Array.isArray(data) ? data : (data?.ventas ?? data?.gastos ?? data?.productos ?? data?.clientes ?? data?.usuarios ?? data?.data ?? []);
}

async function fetchMetrics(filters = {}) {
    const config = tabConfigs[currentTab];
    const token = localStorage.getItem('authToken');
    const url = `${config.endpoint}`;
    
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
    
    // Placeholder metrics calculation
    if (currentTab === 'ventas') {
        const ventas = Array.isArray(data) ? data : (data?.ventas ?? data?.data ?? []);
        const totalIngresos = ventas.reduce((sum, venta) => sum + (venta.total || 0), 0);
        return {
            totalIngresos,
            numeroVentas: ventas.length,
            promedioVenta: ventas.length ? totalIngresos / ventas.length : 0,
            productoTop: 'N/A', // placeholder
            evolution: {
                labels: ventas.slice(-7).map(v => new Date(v.fecha).toLocaleDateString()),
                values: ventas.slice(-7).map(v => v.total || 0)
            },
            distribution: {
                labels: ['Completadas', 'Pendientes'],
                values: [ventas.filter(v => v.estado === 'PAGADA').length, ventas.filter(v => v.estado !== 'PAGADA').length]
            }
        };
    } else {
        // Placeholder for other tabs
        return {
            evolution: { labels: [], values: [] },
            distribution: { labels: [], values: [] }
        };
    }
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
    // Tab events
    document.querySelectorAll('#reportTabs button').forEach(btn => {
        btn.addEventListener('shown.bs.tab', (e) => {
            currentTab = e.target.id.replace('-tab', '');
            loadReports();
        });
    });

    // Filter buttons for each tab
    ['ventas', 'gastos', 'inventario', 'financieros', 'clientes', 'usuarios'].forEach(tab => {
        const btn = document.getElementById('btnApplyFilters' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (btn) {
            btn.addEventListener('click', () => {
                currentTab = tab;
                loadReports();
            });
        }
    });

    document.getElementById('btnRefreshReports').addEventListener('click', () => {
        loadReports();
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