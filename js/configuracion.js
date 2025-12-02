// js/configuracion.js
import { displayError, displayMessage } from './utils.js';
import { getUserProfile, clearUserProfile } from './session.js';

const BASE_API_URL = 'http://127.0.0.1:8081';

// No hay endpoints específicos para perfil en el backend actual
const UPDATE_PROFILE_ENDPOINT = null;
const CHANGE_PASSWORD_ENDPOINT = null;
const EXPORT_DATA_ENDPOINT = null;
const DELETE_ACCOUNT_ENDPOINT = null;

let currentUserProfile = null;
let deleteModalInstance = null;

function loadUserProfileData(profile) {
    currentUserProfile = profile;
    
    // Cargar información del perfil
    document.getElementById('inputNombre').value = profile.nombre || '';
    document.getElementById('inputPrimerApellido').value = profile.primerApellido || '';
    document.getElementById('inputSegundoApellido').value = profile.segundoApellido || '';
    document.getElementById('inputEmail').value = profile.email || '';
    document.getElementById('inputTelefono').value = profile.telefono || '';
    document.getElementById('inputBio').value = profile.bio || '';
    
    // Cargar información de la cuenta
    document.getElementById('userId').textContent = profile.id || 'N/A';
    document.getElementById('userRole').textContent = profile.rol || 'Usuario';
    document.getElementById('userRegistrationDate').textContent = 
        profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A';
    document.getElementById('userLastLogin').textContent = 
        profile.lastLogin ? new Date(profile.lastLogin).toLocaleString() : 'N/A';
    
    // Cargar preferencias (valores por defecto si no existen)
    const preferences = profile.preferences || {};
    document.getElementById('selectIdioma').value = preferences.idioma || 'es';
    document.getElementById('selectTimezone').value = preferences.timezone || 'America/Mexico_City';
    document.getElementById('selectDateFormat').value = preferences.dateFormat || 'DD/MM/YYYY';
    document.getElementById('switchNotifications').checked = preferences.notifications !== false;
    document.getElementById('switchDarkMode').checked = preferences.darkMode === true;
}

async function updateProfile(profilePayload) {
    // Guardar preferencias en localStorage ya que no hay endpoint
    try {
        const preferences = {
            ...JSON.parse(localStorage.getItem('userPreferences') || '{}'),
            ...profilePayload
        };
        localStorage.setItem('userPreferences', JSON.stringify(preferences));
        return preferences;
    } catch (e) {
        throw new Error('No se pudieron guardar las preferencias');
    }
}

async function changePassword(passwordPayload) {
    // No hay endpoint para cambiar contraseña
    throw new Error('El cambio de contraseña no está disponible en el backend actual');
}

async function exportUserData() {
    // Exportar datos locales como JSON
    try {
        const profile = await getUserProfile();
        const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
        const exportData = {
            profile,
            preferences,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `mis_datos_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        
        return true;
    } catch (e) {
        throw new Error('No se pudieron exportar los datos');
    }
}

async function deleteAccount() {
    // No hay endpoint para eliminar cuenta
    throw new Error('La eliminación de cuenta no está disponible en el backend actual');
}

function initProfileForm() {
    document.getElementById('formProfile').addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            nombre: document.getElementById('inputNombre').value.trim(),
            primerApellido: document.getElementById('inputPrimerApellido').value.trim(),
            segundoApellido: document.getElementById('inputSegundoApellido').value.trim(),
            telefono: document.getElementById('inputTelefono').value.trim(),
            bio: document.getElementById('inputBio').value.trim()
        };

        try {
            const btn = document.getElementById('btnSaveProfile');
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

            await updateProfile(payload);
            displayMessage && displayMessage('Perfil actualizado correctamente.');
            
            // Actualizar el perfil en caché
            clearUserProfile();
            const updatedProfile = await getUserProfile({ forceRefresh: true });
            loadUserProfileData(updatedProfile);
        } catch (err) {
            console.error('updateProfile error', err);
            displayError(`No se pudo actualizar el perfil: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnSaveProfile');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardar cambios';
        }
    });
}

function initPasswordForm() {
    document.getElementById('formPassword').addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('inputCurrentPassword').value;
        const newPassword = document.getElementById('inputNewPassword').value;
        const confirmPassword = document.getElementById('inputConfirmNewPassword').value;

        if (newPassword !== confirmPassword) {
            displayError('Las contraseñas nuevas no coinciden.');
            return;
        }

        if (newPassword.length < 6) {
            displayError('La nueva contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (!currentPassword) {
            displayError('Debes ingresar tu contraseña actual.');
            return;
        }

        const payload = {
            currentPassword,
            newPassword
        };

        try {
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Cambiando...';

            await changePassword(payload);
            displayMessage && displayMessage('Contraseña cambiada correctamente.');
            document.getElementById('formPassword').reset();
        } catch (err) {
            console.error('changePassword error', err);
            displayError(`No se pudo cambiar la contraseña: ${err.message || err}`);
        } finally {
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-key"></i> Cambiar contraseña';
        }
    });
}

function initPreferencesForm() {
    document.getElementById('formPreferences').addEventListener('change', async (e) => {
        const payload = {
            preferences: {
                idioma: document.getElementById('selectIdioma').value,
                timezone: document.getElementById('selectTimezone').value,
                dateFormat: document.getElementById('selectDateFormat').value,
                notifications: document.getElementById('switchNotifications').checked,
                darkMode: document.getElementById('switchDarkMode').checked
            }
        };

        try {
            await updateProfile(payload);
            displayMessage && displayMessage('Preferencias guardadas correctamente.');
            
            // Aplicar modo oscuro si se activó
            if (payload.preferences.darkMode) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        } catch (err) {
            console.error('updatePreferences error', err);
            displayError(`No se pudieron guardar las preferencias: ${err.message || err}`);
        }
    });
}

function initAccountActions() {
    // Exportar datos
    document.getElementById('btnExportData').addEventListener('click', async () => {
        try {
            const btn = document.getElementById('btnExportData');
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exportando...';

            await exportUserData();
            displayMessage && displayMessage('Datos exportados correctamente.');
        } catch (err) {
            console.error('exportData error', err);
            displayError(`No se pudieron exportar los datos: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnExportData');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-download"></i> Exportar mis datos';
        }
    });

    // Limpiar caché
    document.getElementById('btnClearCache').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas limpiar el caché local?')) {
            clearUserProfile();
            localStorage.clear();
            sessionStorage.clear();
            displayMessage && displayMessage('Caché limpiado correctamente. La página se recargará.');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        }
    });

    // Eliminar cuenta
    const modalEl = document.getElementById('modalDeleteAccount');
    deleteModalInstance = new bootstrap.Modal(modalEl);

    document.getElementById('btnDeleteAccount').addEventListener('click', () => {
        document.getElementById('inputDeleteConfirmation').value = '';
        document.getElementById('btnConfirmDelete').disabled = true;
        deleteModalInstance.show();
    });

    document.getElementById('inputDeleteConfirmation').addEventListener('input', (e) => {
        const btnConfirm = document.getElementById('btnConfirmDelete');
        btnConfirm.disabled = e.target.value !== 'ELIMINAR';
    });

    document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
        try {
            const btn = document.getElementById('btnConfirmDelete');
            btn.disabled = true;
            btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Eliminando...';

            await deleteAccount();
            displayMessage && displayMessage('Cuenta eliminada correctamente. Serás redirigido...');
            
            setTimeout(() => {
                localStorage.removeItem('authToken');
                clearUserProfile();
                window.location.href = 'index.html';
            }, 2000);
        } catch (err) {
            console.error('deleteAccount error', err);
            displayError(`No se pudo eliminar la cuenta: ${err.message || err}`);
        } finally {
            const btn = document.getElementById('btnConfirmDelete');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-trash"></i> Eliminar cuenta permanentemente';
        }
    });
}

async function init() {
    try {
        const profile = await getUserProfile({ forceRefresh: true });
        loadUserProfileData(profile);

        initProfileForm();
        initPasswordForm();
        initPreferencesForm();
        initAccountActions();
    } catch (err) {
        console.error('init configuracion error', err);
        displayError('Error inicializando módulo de configuración.');
    }
}

if (window.partialsReady) init();
else document.addEventListener('partialsLoaded', init);