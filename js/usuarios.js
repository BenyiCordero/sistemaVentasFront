// js/usuarios.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://localhost:8081/api';

const GET_USERS_ENDPOINT = `${BASE_API_URL}/worker`;
const CREATE_USER_ENDPOINT = `${BASE_API_URL}/auth/register`;
const UPDATE_USER_ENDPOINT = (id) => `${BASE_API_URL}/worker/${id}`;
const GET_SUCURSALES_ENDPOINT = `${BASE_API_URL}/sucursal`;

const usersTableBody = () => document.querySelector('#usersTable tbody');
const usersEmpty = () => document.getElementById('users-empty');

let currentUsers = [];
let sucursales = [];
let modalInstance = null;
let passwordModalInstance = null;
let editingUserId = null;
let changingPasswordUserId = null;

function getRoleBadge(role) {
    const badges = {
        'ROLE_ADMIN': { text: 'ADMINISTRADOR', class: 'danger' },
        'ROLE_GERENTE': { text: 'GERENTE', class: 'primary' },
        'ROLE_VENDEDOR': { text: 'VENDEDOR', class: 'success' },
    };

    const badge = badges[role] || { text: role || 'N/A', class: 'secondary' };
    return `<span class="badge bg-${badge.class}">${badge.text}</span>`;
}

function renderUserRow(user) {
    const id = user.idUsuario ?? user.id ?? '';
    const nombreCompleto = [user.nombre, user.primerApellido].filter(Boolean).join(' ');

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${id}</td>
        <td>${nombreCompleto}</td>
        <td>${user.email ?? ''}</td>
        <td>${user.numeroTelefono ?? ''}</td>
        <td>${getRoleBadge(user.rol ?? '')}</td>
        <td>${user.sucursalNombre ?? ''}</td>
        <td>
            <button class="btn btn-sm btn-outline-primary btn-edit me-1" data-id="${id}">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning btn-password me-1 disabled" data-id="${id}" data-name="${nombreCompleto}">
                <i class="bi bi-key"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger btn-delete disabled" data-id="${id}" data-name="${nombreCompleto}">
                <i class="bi bi-trash"></i>
            </button>
        </td>
    `;
    return tr;
}

function renderUsersTable(users) {
    const tbodyEl = usersTableBody();
    const emptyEl = usersEmpty();

    if (!tbodyEl || !emptyEl) {
        console.error('Tabla de usuarios o elemento "users-empty" no encontrados en el DOM.');
        return;
    }

    tbodyEl.innerHTML = '';

    if (!users || users.length === 0) {
        emptyEl.classList.remove('d-none');
        return;
    }

    emptyEl.classList.add('d-none');
    users.forEach(u => tbodyEl.appendChild(renderUserRow(u)));
}

function filterUsers() {
    const inputSearch = document.getElementById('inputSearch');
    const selectRole = document.getElementById('selectRole');

    const searchTerm = (inputSearch?.value ?? '').toLowerCase().trim();
    const roleFilter = selectRole?.value ?? '';

    const filtered = currentUsers.filter(user => {
        const persona = user.persona ?? {};

        const nombreCompleto = [
            persona.nombre ?? user.nombre,
            persona.primerApellido ?? user.primerApellido,
            persona.segundoApellido ?? user.segundoApellido
        ].filter(Boolean).join(' ').toLowerCase();

        const matchesSearch =
            !searchTerm ||
            nombreCompleto.includes(searchTerm) ||
            (user.email?.toLowerCase().includes(searchTerm)) ||
            ((user.idUsuario ?? user.id ?? '').toString().includes(searchTerm));

        const matchesRole = !roleFilter || (user.rol === roleFilter);

        return matchesSearch && matchesRole;
    });

    renderUsersTable(filtered);
}

function buildHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('authToken');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

async function parseErrorBody(res) {
    try {
        const cloned = res.clone();
        const obj = await cloned.json();
        if (obj && (obj.message || Object.keys(obj).length)) return obj.message || JSON.stringify(obj);
    } catch (_) {
    }
    try {
        const cloned2 = res.clone();
        const txt = await cloned2.text();
        if (txt) return txt;
    } catch (_) {
    }
    return `Status ${res.status}`;
}

async function fetchAllUsers(retry = false) {
    try {
        const res = await fetch(GET_USERS_ENDPOINT, {
            method: 'GET',
            headers: buildHeaders()
        });

        if (!res.ok) {
            if (res.status === 401 && !retry) {
                const { refreshToken } = await import("./session.js");
                await refreshToken();
                return fetchAllUsers(true);
            }
            const txt = await parseErrorBody(res);
            throw new Error(txt);
        }

        const data = await res.json();
        const usersArray = Array.isArray(data) ? data : [data];
        return usersArray.map(u => normalizeWorker(u));
    } catch (err) {
        throw err;
    }
}

function normalizeWorker(u) {
    const usuario = { ...u };

    if (!usuario.idUsuario) usuario.idUsuario = usuario.id ?? null;

    if (usuario.persona) {
        usuario.nombre = usuario.nombre ?? usuario.persona.nombre;
        usuario.primerApellido = usuario.primerApellido ?? usuario.persona.primerApellido;
        usuario.segundoApellido = usuario.segundoApellido ?? usuario.persona.segundoApellido;
        usuario.numeroTelefono = usuario.numeroTelefono ?? usuario.persona.numeroTelefono;
    }

    usuario.sucursalNombre = usuario.sucursalNombre ||
        usuario.nombreSucursal ||
        (usuario.sucursal?.nombre) ||
        (usuario.sucursal?.sucursalNombre) || '';

    usuario.idSucursal = usuario.idSucursal ??
        (usuario.sucursal?.idSucursal) ??
        (usuario.sucursal?.id) ?? null;

    if (usuario.rol && typeof usuario.rol !== 'string') {
        usuario.rol = usuario.rol.name ?? String(usuario.rol);
    }

    return usuario;
}

async function fetchSucursales() {
    try {
        const res = await fetch(GET_SUCURSALES_ENDPOINT, {
            method: 'GET',
            headers: buildHeaders()
        });

        if (!res.ok) {
            const txt = await parseErrorBody(res);
            throw new Error(txt);
        }

        const data = await res.json();
        sucursales = Array.isArray(data) ? data : [];
        populateSucursalSelect();
    } catch (err) {
        console.warn('No se pudieron cargar sucursales:', err.message);
        sucursales = [];
        populateSucursalSelect();
    }
}

function populateSucursalSelect() {
    const select = document.getElementById('selectSucursal');
    if (!select) return;

    const prev = select.value;
    select.innerHTML = `<option value="">Seleccionar sucursal</option>`;

    sucursales.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id ?? s.idSucursal ?? '';
        opt.textContent = s.nombre ?? s.nombreSucursal ?? `Sucursal ${opt.value}`;
        select.appendChild(opt);
    });

    if (prev) select.value = prev;
}

async function createUser(payload) {
    if (payload.sucursal) {
        payload.idSucursal = parseInt(payload.sucursal);
        delete payload.sucursal;
    }

    const res = await fetch(CREATE_USER_ENDPOINT, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const txt = await parseErrorBody(res);
        throw new Error(txt);
    }

    return await res.json();
}

async function updateUser(id, payload) {
    const body = {
        nombre: payload.nombre,
        primerApellido: payload.primerApellido,
        segundoApellido: payload.segundoApellido,
        numeroTelefono: payload.numeroTelefono,
        rol: payload.rol,
        idSucursal: payload.sucursal ? parseInt(payload.sucursal) : null
    };

    const res = await fetch(UPDATE_USER_ENDPOINT(id), {
        method: 'PUT',
        headers: buildHeaders(),
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const txt = await parseErrorBody(res);
        throw new Error(txt);
    }

    return await res.json();
}

async function deleteUser() {
    throw new Error('La eliminación de usuarios no está disponible en el backend actual');
}
async function changeUserPassword() {
    throw new Error('El cambio de contraseña no está disponible en el backend actual');
}

function initModalLogic() {
    const modalEl = document.getElementById('modalUser');
    if (!modalEl) {
        console.warn('modalUser no existe en el DOM. Omitiendo lógica de modales.');
        return;
    }

    modalInstance = new bootstrap.Modal(modalEl);

    const passwordModalEl = document.getElementById('modalChangePassword');
    if (passwordModalEl) passwordModalInstance = new bootstrap.Modal(passwordModalEl);

    const btnOpenNewUser = document.getElementById('btnOpenNewUser');

    if (btnOpenNewUser) {
        btnOpenNewUser.addEventListener('click', async () => {
            editingUserId = null;
            const titleEl = document.getElementById('modalUserTitle');
            titleEl && (titleEl.textContent = 'Nuevo usuario');

            const form = document.getElementById('formUser');
            form && form.reset();

            if (!sucursales.length) await fetchSucursales().catch(() => {});

            document.getElementById('passwordField') && (document.getElementById('passwordField').style.display = 'block');
            document.getElementById('confirmPasswordField') && (document.getElementById('confirmPasswordField').style.display = 'block');

            const ip = document.getElementById('inputPassword');
            const ic = document.getElementById('inputConfirmPassword');
            if (ip) ip.required = true;
            if (ic) ic.required = true;

            modalInstance.show();
        });
    }

    const formUser = document.getElementById('formUser');
    if (formUser) {
        formUser.addEventListener('submit', async e => {
            e.preventDefault();

            const payload = {
                nombre: document.getElementById('inputNombre')?.value.trim() ?? '',
                primerApellido: document.getElementById('inputPrimerApellido')?.value.trim() ?? '',
                segundoApellido: document.getElementById('inputSegundoApellido')?.value.trim() ?? '',
                email: document.getElementById('inputEmail')?.value.trim() ?? '',
                numeroTelefono: document.getElementById('inputTelefono')?.value.trim() ?? '',
                rol: document.getElementById('selectRol')?.value ?? '',
                sucursal: document.getElementById('selectSucursal')?.value ?? null
            };

            const password = document.getElementById('inputPassword')?.value ?? '';

            if (password) {
                const confirm = document.getElementById('inputConfirmPassword')?.value ?? '';
                if (password !== confirm) {
                    displayError('Las contraseñas no coinciden.');
                    return;
                }
                payload.password = password;
            }

            try {
                const btn = document.getElementById('btnSubmitUser');
                if (btn) {
                    btn.disabled = true;
                    btn.textContent = editingUserId ? 'Actualizando...' : 'Guardando...';
                }

                if (editingUserId) {
                    await updateUser(editingUserId, payload);
                    displayMessage('Usuario actualizado correctamente.');
                    // 🔑 Solo si edité MI PROPIO usuario
    const profile = await getUserProfile().catch(() => null);
    const loggedUserId =
        profile?.idUsuario ??
        profile?.id ??
        profile?.usuarioId ??
        null;

    if (
        loggedUserId &&
        String(editingUserId) === String(loggedUserId) &&
        payload.sucursal
    ) {
        localStorage.setItem('sucursalId', payload.sucursal);

        // 🔔 Notificar a otros módulos (ventas, inventario, etc.)
        document.dispatchEvent(
            new CustomEvent('sucursalUpdated', {
                detail: { sucursalId: payload.sucursal }
            })
        );
    }
                } else {
                    await createUser(payload);
                    displayMessage('Usuario creado correctamente.');
                }

                modalInstance.hide();
                await loadUsers();
            } catch (err) {
                displayError(`No se pudo guardar el usuario: ${err.message}`);
            } finally {
                const btn = document.getElementById('btnSubmitUser');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Guardar usuario';
                }
            }
        });
    } else {
        console.warn('formUser no encontrado. Omitiendo lógica de envío de usuario.');
    }
}

function initTableHandlers() {
    const btnRefresh = document.getElementById('btnRefreshUsers');
    if (btnRefresh) btnRefresh.addEventListener('click', loadUsers);

    document.getElementById('btnFilter')?.addEventListener('click', filterUsers);
    document.getElementById('inputSearch')?.addEventListener('input', filterUsers);
    document.getElementById('selectRole')?.addEventListener('change', filterUsers);

    const tbody = document.querySelector('#usersTable tbody');
    if (!tbody) {
        console.warn('Tabla de usuarios no encontrada. initTableHandlers abortado.');
        return;
    }

    tbody.addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        const btnDelete = e.target.closest('.btn-delete');
        const btnPassword = e.target.closest('.btn-password');

        if (btnEdit) {
            const id = btnEdit.getAttribute('data-id');
            const user = currentUsers.find(u => (u.idUsuario ?? u.id ?? '').toString() === (id ?? '').toString());

            if (!user) return;

            editingUserId = id;
            const titleEl = document.getElementById('modalUserTitle');
            titleEl && (titleEl.textContent = 'Editar usuario');

            if (!sucursales.length) await fetchSucursales().catch(() => {});

            document.getElementById('inputNombre') && (document.getElementById('inputNombre').value = user.nombre ?? '');
            document.getElementById('inputPrimerApellido') && (document.getElementById('inputPrimerApellido').value = user.primerApellido ?? '');
            document.getElementById('inputSegundoApellido') && (document.getElementById('inputSegundoApellido').value = user.segundoApellido ?? '');
            document.getElementById('inputEmail') && (document.getElementById('inputEmail').value = user.email ?? '');
            document.getElementById('inputTelefono') && (document.getElementById('inputTelefono').value = user.numeroTelefono ?? '');
            document.getElementById('selectRol') && (document.getElementById('selectRol').value = user.rol ?? '');

            const idSucursalGuess = user.idSucursal ?? user.sucursal?.id ?? null;
            if (document.getElementById('selectSucursal')) document.getElementById('selectSucursal').value = idSucursalGuess ?? '';

            document.getElementById('passwordField') && (document.getElementById('passwordField').style.display = 'none');
            document.getElementById('confirmPasswordField') && (document.getElementById('confirmPasswordField').style.display = 'none');

            modalInstance.show();
        }

        if (btnPassword) {
            changingPasswordUserId = btnPassword.getAttribute('data-id');
            document.getElementById('formChangePassword')?.reset();
            passwordModalInstance?.show();
        }

        if (btnDelete) {
            const name = btnDelete.getAttribute('data-name');
            if (confirm(`¿Estás seguro de que deseas eliminar al usuario "${name}"?`)) {
                try {
                    await deleteUser();
                } catch (err) {
                    displayError(`No se pudo eliminar el usuario: ${err.message}`);
                }
            }
        }
    });
}

async function loadUsers() {
    try {
        currentUsers = await fetchAllUsers();
        filterUsers();
    } catch (err) {
        displayError(`Error cargando usuarios: ${err.message}`);
        renderUsersTable([]);
    }
}

async function init() {
    try {
        await getUserProfile().catch(() => null);

        await fetchSucursales().catch(() => {});
        initModalLogic();
        initTableHandlers();
        await loadUsers();
    } catch (err) {
        console.error('Error inicializando módulo de usuarios:', err);
        displayError(`Error inicializando módulo de usuarios.`);
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);