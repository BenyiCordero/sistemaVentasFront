// js/usuarios.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile } from './session.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

const GET_USERS_ENDPOINT = `${BASE_API_URL}/users`;
const CREATE_USER_ENDPOINT = `${BASE_API_URL}/users`;
const UPDATE_USER_ENDPOINT = (id) => `${BASE_API_URL}/users/${id}`;
const DELETE_USER_ENDPOINT = (id) => `${BASE_API_URL}/users/${id}`;
const CHANGE_PASSWORD_ENDPOINT = (id) => `${BASE_API_URL}/users/${id}/password`;

const usersTableBody = () => document.querySelector('#usersTable tbody');
const usersEmpty = () => document.getElementById('users-empty');

let currentUsers = [];
let modalInstance = null;
let passwordModalInstance = null;
let editingUserId = null;
let changingPasswordUserId = null;

function getRoleBadge(role) {
    const badges = {
        'admin': { text: 'Administrador', class: 'danger' },
        'vendedor': { text: 'Vendedor', class: 'primary' },
        'inventario': { text: 'Inventario', class: 'info' },
        'reportes': { text: 'Reportes', class: 'warning' }
    };
    const badge = badges[role] || { text: role, class: 'secondary' };
    return `<span class="badge bg-${badge.class}">${badge.text}</span>`;
}

function getStatusBadge(status) {
    const badges = {
        'activo': { text: 'Activo', class: 'success' },
        'inactivo': { text: 'Inactivo', class: 'secondary' },
        'suspendido': { text: 'Suspendido', class: 'danger' }
    };
    const badge = badges[status] || { text: status, class: 'secondary' };
    return `<span class="badge bg-${badge.class}">${badge.text}</span>`;
}

function renderUserRow(user) {
    const tr = document.createElement('tr');
    const nombreCompleto = [user.nombre, user.primerApellido, user.segundoApellido]
        .filter(Boolean).join(' ');
    const fechaRegistro = new Date(user.createdAt || user.fechaRegistro || Date.now()).toLocaleDateString();
    
    tr.innerHTML = `
    <td>${user.id ?? ''}</td>
    <td>${nombreCompleto}</td>
    <td>${user.email ?? ''}</td>
    <td>${user.telefono || 'N/A'}</td>
    <td>${getRoleBadge(user.rol)}</td>
    <td>${getStatusBadge(user.estado)}</td>
    <td>${fechaRegistro}</td>
    <td>
        <button class="btn btn-sm btn-outline-primary btn-edit me-1" data-id="${user.id}">
            <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-warning btn-password me-1" data-id="${user.id}" data-name="${nombreCompleto}">
            <i class="bi bi-key"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${user.id}" data-name="${nombreCompleto}">
            <i class="bi bi-trash"></i>
        </button>
    </td>
    `;
    return tr;
}

function renderUsersTable(users) {
    const tbody = usersTableBody();
    tbody.innerHTML = '';
    if (!users || users.length === 0) {
        usersEmpty().classList.remove('d-none');
        return;
    }
    usersEmpty().classList.add('d-none');
    users.forEach(user => tbody.appendChild(renderUserRow(user)));
}

function filterUsers() {
    const searchTerm = document.getElementById('inputSearch').value.toLowerCase();
    const roleFilter = document.getElementById('selectRole').value;
    const statusFilter = document.getElementById('selectStatus').value;

    let filtered = currentUsers.filter(user => {
        const nombreCompleto = [user.nombre, user.primerApellido, user.segundoApellido]
            .filter(Boolean).join(' ').toLowerCase();
        
        const matchesSearch = !searchTerm || 
            nombreCompleto.includes(searchTerm) || 
            (user.email?.toLowerCase().includes(searchTerm)) ||
            (user.id?.toString().includes(searchTerm));
        
        const matchesRole = !roleFilter || user.rol === roleFilter;
        const matchesStatus = !statusFilter || user.estado === statusFilter;

        return matchesSearch && matchesRole && matchesStatus;
    });

    renderUsersTable(filtered);
}

async function fetchUsers() {
    const token = localStorage.getItem('authToken');
    const res = await fetch(GET_USERS_ENDPOINT, {
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
    return Array.isArray(data) ? data : (data?.users ?? data?.data ?? []);
}

async function createUser(userPayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(CREATE_USER_ENDPOINT, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userPayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function updateUser(id, userPayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(UPDATE_USER_ENDPOINT(id), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userPayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

async function deleteUser(id) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(DELETE_USER_ENDPOINT(id), {
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

async function changeUserPassword(id, passwordPayload) {
    const token = localStorage.getItem('authToken');
    const res = await fetch(CHANGE_PASSWORD_ENDPOINT(id), {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(passwordPayload)
    });
    if (!res.ok) {
        let txt = `Status ${res.status}`;
        try { const obj = await res.json(); txt = obj.message || JSON.stringify(obj); } catch (e) { const t = await res.text(); if (t) txt = t; }
        throw new Error(txt);
    }
    return await res.json();
}

function initModalLogic() {
    const modalEl = document.getElementById('modalUser');
    modalInstance = new bootstrap.Modal(modalEl);

    const passwordModalEl = document.getElementById('modalChangePassword');
    passwordModalInstance = new bootstrap.Modal(passwordModalEl);

    document.getElementById('btnOpenNewUser').addEventListener('click', () => {
        editingUserId = null;
        document.getElementById('modalUserTitle').textContent = 'Nuevo usuario';
        document.getElementById('formUser').reset();
        document.getElementById('selectEstado').value = 'activo';
        document.getElementById('passwordField').style.display = 'block';
        document.getElementById('confirmPasswordField').style.display = 'block';
        document.getElementById('inputPassword').required = true;
        document.getElementById('inputConfirmPassword').required = true;
        modalInstance.show();
    });

    document.getElementById('formUser').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            nombre: document.getElementById('inputNombre').value.trim(),
            primerApellido: document.getElementById('inputPrimerApellido').value.trim(),
            segundoApellido: document.getElementById('inputSegundoApellido').value.trim(),
            email: document.getElementById('inputEmail').value.trim(),
            telefono: document.getElementById('inputTelefono').value.trim(),
            rol: document.getElementById('selectRol').value,
            estado: document.getElementById('selectEstado').value,
            notas: document.getElementById('inputNotas').value.trim()
        };

        // Solo incluir contraseña en creación o si se proporciona
        const password = document.getElementById('inputPassword').value;
        if (password) {
            payload.password = password;
        }

        // Validar contraseñas si se proporcionan
        if (password && password !== document.getElementById('inputConfirmPassword').value) {
            displayError('Las contraseñas no coinciden.');
            return;
        }

        try {
            const btn = document.getElementById('btnSubmitUser');
            btn.disabled = true;
            btn.textContent = editingUserId ? 'Actualizando...' : 'Guardando...';

            if (editingUserId) {
                await updateUser(editingUserId, payload);
                displayMessage && displayMessage('Usuario actualizado correctamente.');
            } else {
                await createUser(payload);
                displayMessage && displayMessage('Usuario creado correctamente.');
            }

            modalInstance.hide();
            await loadUsers();
        } catch (err) {
            console.error('saveUser error', err);
            displayError(`No se pudo guardar el usuario: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitUser');
            btn.disabled = false;
            btn.textContent = 'Guardar usuario';
        }
    });

    document.getElementById('formChangePassword').addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('inputNewPassword').value;
        const confirmPassword = document.getElementById('inputConfirmNewPassword').value;

        if (newPassword !== confirmPassword) {
            displayError('Las contraseñas no coinciden.');
            return;
        }

        if (newPassword.length < 6) {
            displayError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        try {
            const btn = document.getElementById('btnSubmitPassword');
            btn.disabled = true;
            btn.textContent = 'Cambiando...';

            await changeUserPassword(changingPasswordUserId, { password: newPassword });
            displayMessage && displayMessage('Contraseña cambiada correctamente.');
            passwordModalInstance.hide();
        } catch (err) {
            console.error('changePassword error', err);
            displayError(`No se pudo cambiar la contraseña: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSubmitPassword');
            btn.disabled = false;
            btn.textContent = 'Cambiar contraseña';
        }
    });
}

function initTableHandlers() {
    document.getElementById('btnRefreshUsers').addEventListener('click', () => {
        loadUsers();
    });

    document.getElementById('btnFilter').addEventListener('click', () => {
        filterUsers();
    });

    document.getElementById('inputSearch').addEventListener('input', () => {
        filterUsers();
    });

    document.getElementById('selectRole').addEventListener('change', () => {
        filterUsers();
    });

    document.getElementById('selectStatus').addEventListener('change', () => {
        filterUsers();
    });

    document.querySelector('#usersTable tbody').addEventListener('click', async (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        const btnDelete = e.target.closest('.btn-delete');
        const btnPassword = e.target.closest('.btn-password');

        if (btnEdit) {
            const id = btnEdit.getAttribute('data-id');
            const user = currentUsers.find(u => u.id == id);
            if (user) {
                editingUserId = id;
                document.getElementById('modalUserTitle').textContent = 'Editar usuario';
                document.getElementById('inputNombre').value = user.nombre || '';
                document.getElementById('inputPrimerApellido').value = user.primerApellido || '';
                document.getElementById('inputSegundoApellido').value = user.segundoApellido || '';
                document.getElementById('inputEmail').value = user.email || '';
                document.getElementById('inputTelefono').value = user.telefono || '';
                document.getElementById('selectRol').value = user.rol || '';
                document.getElementById('selectEstado').value = user.estado || 'activo';
                document.getElementById('inputNotas').value = user.notas || '';
                
                // Ocultar campos de contraseña en edición
                document.getElementById('passwordField').style.display = 'none';
                document.getElementById('confirmPasswordField').style.display = 'none';
                document.getElementById('inputPassword').required = false;
                document.getElementById('inputConfirmPassword').required = false;
                
                modalInstance.show();
            }
        }

        if (btnPassword) {
            const id = btnPassword.getAttribute('data-id');
            const name = btnPassword.getAttribute('data-name');
            changingPasswordUserId = id;
            document.getElementById('formChangePassword').reset();
            passwordModalInstance.show();
        }

        if (btnDelete) {
            const id = btnDelete.getAttribute('data-id');
            const name = btnDelete.getAttribute('data-name');
            if (confirm(`¿Estás seguro de que deseas eliminar al usuario "${name}"?`)) {
                try {
                    await deleteUser(id);
                    displayMessage && displayMessage('Usuario eliminado correctamente.');
                    await loadUsers();
                } catch (err) {
                    console.error('deleteUser error', err);
                    displayError(`No se pudo eliminar el usuario: ${err.message || err}`);
                }
            }
        }
    });
}

async function loadUsers() {
    try {
        const users = await fetchUsers();
        currentUsers = users;
        filterUsers();
    } catch (err) {
        console.error('loadUsers error', err);
        displayError(`Error cargando usuarios: ${err.message || err}`);
        renderUsersTable([]);
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
        await loadUsers();
    } catch (err) {
        console.error('init usuarios error', err);
        displayError('Error inicializando módulo de usuarios.');
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);