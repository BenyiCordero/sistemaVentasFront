// js/creditos.js
import { displayError, displayMessage, showToast } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = '/api';

// Endpoints
const GET_CREDITOS_SUCURSAL = (sucursalId) => `${BASE_API_URL}/credito/sucursal/${sucursalId}`;
const GET_CREDITO_DETALLES = (id) => `${BASE_API_URL}/credito/${id}`;
const CREATE_CREDITO_ENDPOINT = `${BASE_API_URL}/credito`;
const PROCESAR_PAGO_ENDPOINT = `${BASE_API_URL}/credito/pago`;
const GET_PAGOS_CREDITO = (id) => `${BASE_API_URL}/credito-pagos/credito/${id}`;
const GET_VENTAS_SIN_CREDITO = (sucursalId) => `${BASE_API_URL}/sell/sucursal/${sucursalId}`;
const GET_CLIENTS_ENDPOINT = `${BASE_API_URL}/client`;

// Elementos DOM
const creditosTableBody = () => document.querySelector('#creditosTable tbody');
const creditosEmpty = () => document.getElementById('creditos-empty');

// Estado
let currentSucursalId = null;
let currentCreditos = [];
let currentVentas = [];
let currentClients = [];
let currentCreditoId = null;

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadInitialData();
});

function setupEventListeners() {
    // Botones principales
    document.getElementById('btnRefreshCreditos')?.addEventListener('click', loadCreditos);
    document.getElementById('btnNuevoCredito')?.addEventListener('click', openModalNuevoCredito);
    document.getElementById('btnExportarExcel')?.addEventListener('click', exportarCreditosExcel);
    document.getElementById('btnAplicarFiltros')?.addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros')?.addEventListener('click', limpiarFiltros);

    // Formularios
    document.getElementById('formNuevoCredito')?.addEventListener('submit', handleNuevoCredito);
    document.getElementById('formProcesarPago')?.addEventListener('submit', handleProcesarPago);

    // Autocomplete para ventas
    setupVentaAutocomplete();
}

async function loadInitialData() {
    try {
        const profile = getUserProfile();
        if (!profile?.sucursal?.idSucursal) {
            displayError('No se encontró sucursal en el perfil');
            return;
        }

        currentSucursalId = profile.sucursal.idSucursal;
        
        // Cargar datos en paralelo
        await Promise.all([
            loadCreditos(),
            loadVentasParaCreditos(),
            loadClients()
        ]);

        updateDashboard();
    } catch (error) {
        console.error('Error cargando datos iniciales:', error);
        displayError('Error cargando datos iniciales');
    }
}

async function loadCreditos() {
    try {
        const response = await fetch(GET_CREDITOS_SUCURSAL(currentSucursalId), {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Error cargando créditos');
        
        const data = await response.json();
        currentCreditos = data || [];
        
        renderCreditosTable(currentCreditos);
    } catch (error) {
        console.error('Error en loadCreditos:', error);
        displayError('Error cargando créditos');
    }
}

async function loadVentasParaCreditos() {
    try {
        const response = await fetch(GET_VENTAS_SIN_CREDITO(currentSucursalId), {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Error cargando ventas');
        
        const data = await response.json();
        currentVentas = data || [];
    } catch (error) {
        console.error('Error cargando ventas:', error);
    }
}

async function loadClients() {
    try {
        const response = await fetch(GET_CLIENTS_ENDPOINT, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Error cargando clientes');
        
        const data = await response.json();
        currentClients = data || [];
    } catch (error) {
        console.error('Error cargando clientes:', error);
    }
}

function renderCreditosTable(creditos) {
    const tbody = creditosTableBody();
    const emptyMsg = creditosEmpty();

    if (creditos.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.classList.remove('d-none');
        return;
    }

    emptyMsg.classList.add('d-none');
    tbody.innerHTML = creditos.map(credito => `
        <tr data-credito-id="${credito.idCredito}">
            <td>${credito.idCredito}</td>
            <td>${credito.venta?.cliente?.persona?.nombre || 'N/A'} ${credito.venta?.cliente?.persona?.apellido || ''}</td>
            <td>${credito.venta?.idVenta || 'N/A'}</td>
            <td>$${formatearNumero(credito.montoInicial)}</td>
            <td class="${credito.saldo > 0 ? 'text-warning' : 'text-success'}">
                $${formatearNumero(credito.saldo)}
            </td>
            <td>${credito.tasaInteres}%</td>
            <td>${credito.plazoMeses} meses</td>
            <td>${getEstadoBadge(credito.estado)}</td>
            <td>${formatearFecha(credito.fechaVencimiento)}</td>
            <td>${getProgresoBar(credito)}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="verDetallesCredito(${credito.idCredito})">
                    <i class="bi bi-eye"></i>
                </button>
                ${credito.saldo > 0 ? `
                    <button class="btn btn-sm btn-success me-1" onclick="procesarPago(${credito.idCredito})">
                        <i class="bi bi-cash"></i>
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-primary" onclick="verPagos(${credito.idCredito})">
                    <i class="bi bi-list-ul"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function getEstadoBadge(estado) {
    const badges = {
        'ACTIVO': '<span class="badge bg-success">Activo</span>',
        'PAGADO': '<span class="badge bg-primary">Pagado</span>',
        'MOROSO': '<span class="badge bg-danger">Vencido</span>'
    };
    return badges[estado] || `<span class="badge bg-secondary">${estado}</span>`;
}

function getProgresoBar(credito) {
    const progreso = ((credito.montoInicial - credito.saldo) / credito.montoInicial) * 100;
    const color = progreso === 100 ? 'success' : progreso >= 75 ? 'info' : progreso >= 50 ? 'warning' : 'danger';
    
    return `
        <div class="progress" style="height: 20px;">
            <div class="progress-bar bg-${color}" style="width: ${progreso}%">
                ${Math.round(progreso)}%
            </div>
        </div>
    `;
}

// Funciones para modales y formularios
function openModalNuevoCredito() {
    const modal = new bootstrap.Modal(document.getElementById('modalNuevoCredito'));
    modal.show();
}

async function handleNuevoCredito(e) {
    e.preventDefault();
    
    const formData = {
        idVenta: document.getElementById('idVenta').value,
        montoInicial: parseFloat(document.getElementById('inputMontoCredito').value),
        tasaInteres: parseFloat(document.getElementById('inputTasaInteres').value),
        plazoMeses: parseInt(document.getElementById('inputPlazoMeses').value),
        notas: document.getElementById('inputNotasCredito').value
    };

    try {
        const response = await fetch(CREATE_CREDITO_ENDPOINT, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error creando crédito');
        }
        
        showToast('Crédito creado exitosamente', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modalNuevoCredito')).hide();
        loadCreditos();
        
    } catch (error) {
        console.error('Error en handleNuevoCredito:', error);
        displayError(error.message || 'Error creando crédito');
    }
}

function procesarPago(creditoId) {
    const credito = currentCreditos.find(c => c.idCredito === creditoId);
    if (!credito) return;

    currentCreditoId = creditoId;
    
    // Llenar información en el modal
    document.getElementById('pagoCreditoId').textContent = creditoId;
    document.getElementById('pagoSaldoActual').textContent = `$${formatearNumero(credito.saldo)}`;
    document.getElementById('pagoCliente').textContent = 
        `${credito.venta?.cliente?.persona?.nombre || 'N/A'} ${credito.venta?.cliente?.persona?.apellido || ''}`;
    
    // Configurar el input de monto
    const inputMonto = document.getElementById('inputMontoPago');
    inputMonto.max = credito.saldo;
    inputMonto.value = '';
    document.getElementById('saldoRestante').textContent = '';
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('modalProcesarPago'));
    modal.show();
}

async function handleProcesarPago(e) {
    e.preventDefault();
    
    const montoPago = parseFloat(document.getElementById('inputMontoPago').value);
    const credito = currentCreditos.find(c => c.idCredito === currentCreditoId);
    
    if (montoPago > credito.saldo) {
        displayError('El monto del pago no puede exceder el saldo pendiente');
        return;
    }

    const formData = {
        idCredito: currentCreditoId,
        monto: montoPago,
        metodoPago: document.getElementById('inputMetodoPago').value,
        notas: document.getElementById('inputNotasPago').value
    };

    try {
        const response = await fetch(PROCESAR_PAGO_ENDPOINT, {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error procesando pago');
        }
        
        showToast('Pago procesado exitosamente', 'success');
        bootstrap.Modal.getInstance(document.getElementById('modalProcesarPago')).hide();
        loadCreditos();
        
    } catch (error) {
        console.error('Error en handleProcesarPago:', error);
        displayError(error.message || 'Error procesando pago');
    }
}

async function verDetallesCredito(creditoId) {
    try {
        const response = await fetch(GET_CREDITO_DETALLES(creditoId), {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Error cargando detalles');
        
        const credito = await response.json();
        
        // Renderizar detalles en el modal
        const content = document.getElementById('detallesCreditoContent');
        content.innerHTML = renderDetallesCredito(credito);
        
        const modal = new bootstrap.Modal(document.getElementById('modalDetallesCredito'));
        modal.show();
        
    } catch (error) {
        console.error('Error en verDetallesCredito:', error);
        displayError('Error cargando detalles del crédito');
    }
}

function renderDetallesCredito(credito) {
    return `
        <div class="row">
            <div class="col-md-6">
                <h6>Información del Crédito</h6>
                <table class="table table-sm">
                    <tr><td><strong>ID:</strong></td><td>${credito.idCredito}</td></tr>
                    <tr><td><strong>Monto Inicial:</strong></td><td>$${formatearNumero(credito.montoInicial)}</td></tr>
                    <tr><td><strong>Saldo Actual:</strong></td><td>$${formatearNumero(credito.saldo)}</td></tr>
                    <tr><td><strong>Tasa Interés:</strong></td><td>${credito.tasaInteres}%</td></tr>
                    <tr><td><strong>Plazo:</strong></td><td>${credito.plazoMeses} meses</td></tr>
                    <tr><td><strong>Estado:</strong></td><td>${getEstadoBadge(credito.estado)}</td></tr>
                    <tr><td><strong>Fecha Inicio:</strong></td><td>${formatearFecha(credito.fechaInicio)}</td></tr>
                    <tr><td><strong>Fecha Vencimiento:</strong></td><td>${formatearFecha(credito.fechaVencimiento)}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6>Información del Cliente y Venta</h6>
                <table class="table table-sm">
                    <tr><td><strong>Cliente:</strong></td><td>${credito.venta?.cliente?.persona?.nombre || 'N/A'} ${credito.venta?.cliente?.persona?.apellido || ''}</td></tr>
                    <tr><td><strong>ID Venta:</strong></td><td>${credito.venta?.idVenta || 'N/A'}</td></tr>
                    <tr><td><strong>Total Venta:</strong></td><td>$${formatearNumero(credito.venta?.totalVenta || 0)}</td></tr>
                    <tr><td><strong>Fecha Venta:</strong></td><td>${formatearFecha(credito.venta?.fechaVenta)}</td></tr>
                </table>
            </div>
        </div>
        <div class="row mt-4">
            <div class="col-12">
                <h6>Historial de Pagos</h6>
                <div id="pagosCreditoContent">
                    <div class="text-center">Cargando pagos...</div>
                </div>
            </div>
        </div>
    `;
}

// Función para exportar a Excel
async function exportarCreditosExcel() {
    try {
        const exportData = currentCreditos.map(credito => ({
            'ID Crédito': credito.idCredito,
            'Cliente': `${credito.venta?.cliente?.persona?.nombre || ''} ${credito.venta?.cliente?.persona?.apellido || ''}`.trim(),
            'ID Venta': credito.venta?.idVenta || '',
            'Monto Inicial': credito.montoInicial,
            'Saldo Pendiente': credito.saldo,
            'Tasa Interés': credito.tasaInteres,
            'Plazo Meses': credito.plazoMeses,
            'Estado': credito.estado,
            'Fecha Inicio': credito.fechaInicio,
            'Fecha Vencimiento': credito.fechaVencimiento,
            'Fecha Venta': credito.venta?.fechaVenta || '',
            'Total Venta': credito.venta?.totalVenta || 0
        }));

        // Crear Excel usando SheetJS
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Créditos");
        
        // Descargar archivo
        const fechaActual = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `creditos_${fechaActual}.xlsx`);
        
        showToast('Archivo Excel exportado exitosamente', 'success');
    } catch (error) {
        console.error('Error exportando a Excel:', error);
        displayError('Error al exportar a Excel');
    }
}

// Funciones de utilidad
function formatearNumero(num) {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
}

function formatearFecha(fecha) {
    if (!fecha) return 'N/A';
    return new Date(fecha).toLocaleDateString('es-MX');
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Autocomplete para ventas (similar al de ventas.js)
function setupVentaAutocomplete() {
    const inputEl = document.getElementById('inputVenta');
    const hiddenEl = document.getElementById('idVenta');
    const suggestionsEl = document.getElementById('ventaSuggestions');

    function updateSuggestions(query) {
        const filtered = currentVentas.filter(venta => 
            `${venta.idVenta} ${venta.cliente?.persona?.nombre || ''} ${venta.cliente?.persona?.apellido || ''}`.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 20);

        suggestionsEl.innerHTML = '';
        if (filtered.length === 0) {
            suggestionsEl.innerHTML = '<div class="autocomplete-item no-results">No se encontraron ventas</div>';
            return;
        }

        filtered.forEach(venta => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = `Venta #${venta.idVenta} - ${venta.cliente?.persona?.nombre || ''} ${venta.cliente?.persona?.apellido || ''} - $${formatearNumero(venta.totalVenta)}`;
            div.addEventListener('click', () => {
                inputEl.value = `Venta #${venta.idVenta} - ${venta.cliente?.persona?.nombre || ''} ${venta.cliente?.persona?.apellido || ''}`;
                hiddenEl.value = venta.idVenta;
                
                // Llenar cliente automáticamente
                document.getElementById('clienteDisplay').value = 
                    `${venta.cliente?.persona?.nombre || ''} ${venta.cliente?.persona?.apellido || ''}`.trim();
                
                // Llenar monto automáticamente
                document.getElementById('inputMontoCredito').value = venta.totalVenta;
                
                suggestionsEl.style.display = 'none';
            });
            suggestionsEl.appendChild(div);
        });
    }

    inputEl?.addEventListener('focus', () => {
        updateSuggestions(inputEl.value);
        suggestionsEl.style.display = 'block';
    });

    inputEl?.addEventListener('input', () => {
        updateSuggestions(inputEl.value);
        suggestionsEl.style.display = 'block';
    });

    inputEl?.addEventListener('blur', () => {
        setTimeout(() => suggestionsEl.style.display = 'none', 200);
    });
}

// Actualizar dashboard
function updateDashboard() {
    const activos = currentCreditos.filter(c => c.estado === 'ACTIVO');
    const pagados = currentCreditos.filter(c => c.estado === 'PAGADO');
    const vencidos = currentCreditos.filter(c => c.estado === 'MOROSO');

    document.getElementById('totalActivos').textContent = `$${formatearNumero(activos.reduce((sum, c) => sum + c.saldo, 0))}`;
    document.getElementById('totalPagados').textContent = pagados.length;
    document.getElementById('totalVencidos').textContent = `$${formatearNumero(vencidos.reduce((sum, c) => sum + c.saldo, 0))}`;
    
    // Calcular pagos del mes (esto requeriría otro endpoint, por ahora mostramos 0)
    document.getElementById('pagosMes').textContent = '$0.00';
}

// Filtros
function aplicarFiltros() {
    const estado = document.getElementById('filtroEstado').value;
    const cliente = document.getElementById('filtroCliente').value.toLowerCase();
    const ordenarPor = document.getElementById('ordenarPor').value;

    let filtrados = [...currentCreditos];

    // Filtrar por estado
    if (estado) {
        filtrados = filtrados.filter(c => c.estado === estado);
    }

    // Filtrar por cliente
    if (cliente) {
        filtrados = filtrados.filter(c => 
            `${c.venta?.cliente?.persona?.nombre || ''} ${c.venta?.cliente?.persona?.apellido || ''}`.toLowerCase().includes(cliente)
        );
    }

    // Ordenar
    filtrados.sort((a, b) => {
        switch (ordenarPor) {
            case 'montoInicial': return b.montoInicial - a.montoInicial;
            case 'saldo': return b.saldo - a.saldo;
            case 'fechaInicio': return new Date(b.fechaInicio) - new Date(a.fechaInicio);
            case 'fechaVencimiento': return new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento);
            default: return 0;
        }
    });

    renderCreditosTable(filtrados);
}

function limpiarFiltros() {
    document.getElementById('filtroEstado').value = '';
    document.getElementById('filtroCliente').value = '';
    document.getElementById('ordenarPor').value = 'fechaVencimiento';
    renderCreditosTable(currentCreditos);
}

// Ver pagos de un crédito
async function verPagos(creditoId) {
    try {
        const response = await fetch(GET_PAGOS_CREDITO(creditoId), {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Error cargando pagos');
        
        const pagos = await response.json();
        
        // Actualizar el contenido de pagos en el modal de detalles
        const pagosContent = document.getElementById('pagosCreditoContent');
        if (pagosContent) {
            pagosContent.innerHTML = renderPagosTable(pagos.creditosPagos || []);
        }
        
    } catch (error) {
        console.error('Error en verPagos:', error);
        displayError('Error cargando pagos del crédito');
    }
}

function renderPagosTable(pagos) {
    if (pagos.length === 0) {
        return '<div class="text-center text-muted">No hay pagos registrados</div>';
    }

    return `
        <div class="table-responsive">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Monto</th>
                        <th>Método</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagos.map(pago => `
                        <tr>
                            <td>${pago.id}</td>
                            <td>${formatearFecha(pago.fecha)}</td>
                            <td>$${formatearNumero(pago.monto)}</td>
                            <td>${pago.pago?.metodoPago || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Input listener para mostrar saldo restante al procesar pago
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('inputMontoPago')?.addEventListener('input', function() {
        const credito = currentCreditos.find(c => c.idCredito === currentCreditoId);
        if (credito) {
            const montoPago = parseFloat(this.value) || 0;
            const saldoRestante = credito.saldo - montoPago;
            
            document.getElementById('saldoRestante').textContent = 
                `Saldo restante después del pago: $${formatearNumero(saldoRestante)}`;
        }
    });
});