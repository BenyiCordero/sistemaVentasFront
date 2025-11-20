import { displayError, clearError, displayMessage, clearMessage } from './utils.js';

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const logoutButton = document.getElementById('logout-button');
const showLoginLink = document.getElementById('show-login');

const authError = document.getElementById('auth-error');
const authMessage = document.getElementById('auth-message');

const BASE_API_URL = 'http://127.0.0.1:8081';
const LOGIN_API_URL = `${BASE_API_URL}/auth/login`;
const REGISTER_API_URL = `${BASE_API_URL}/auth/register`;
const REFRESH_API_URL = `${BASE_API_URL}/auth/refresh`;
const LOGOUT_API_URL = `${BASE_API_URL}/auth/logout`;

let accessToken = null; 

async function checkAuthStatus() {
    const isOnLoginPage = window.location.pathname.includes('index.html');
    const isOnRegisterPage = window.location.pathname.includes('register.html');

    if (accessToken) {
        if (isOnLoginPage) window.location.href = 'landingPage.html';
        return;
    }

    try {
        const resp = await fetch(REFRESH_API_URL, {
            method: 'POST',
            credentials: 'include'
        });

        if (resp.ok) {
            const data = await resp.json();
            accessToken = data.access_token;
            if (isOnLoginPage) window.location.href = 'landingPage.html';
        } else {
            if (!isOnLoginPage && !isOnRegisterPage) {
                window.location.href = 'index.html';
            }
        }
    } catch (err) {
        console.error('Error checking auth status:', err);
        if (!isOnLoginPage && !isOnRegisterPage) {
            window.location.href = 'index.html';
        }
    }
}

async function fetchProtected(url, options = {}) {
    const headers = options.headers ? { ...options.headers } : {};

    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const resp = await fetch(url, {
        options,
        headers,
        credentials: 'include'
    });

    if (resp.status === 401) {
        const refreshResp = await fetch(REFRESH_API_URL, {
            method: 'POST',
            credentials: 'include'
        });

        if (refreshResp.ok) {
            const refreshData = await refreshResp.json();
            accessToken = refreshData.access_token;
            headers['Authorization'] = `Bearer ${accessToken}`;
            return fetch(url, { ...options, headers, credentials: 'include' });
        } else {
            accessToken = null;
            window.location.href = 'index.html';
            return Promise.reject(new Error('Not authenticated'));
        }
    }

    return resp;
}

if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;

        if (authError) clearError(authError);
        if (authMessage) clearMessage(authMessage);

        try {
            const response = await fetch(LOGIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email: username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error en login');
            }

            if (data.access_token) {
                accessToken = data.access_token;
                if (authMessage) displayMessage(authMessage, '¡Inicio de sesión exitoso!');
                window.location.href = 'landingPage.html';
            } else {
                throw new Error('No se recibió access_token del servidor');
            }
        } catch (err) {
            console.error(err);
            if (authError) displayError(authError, err.message || 'Error al iniciar sesión');
        }
    });
}

if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const nombre = registerForm.nombre.value;
        const primerApe = registerForm.primerApe.value;
        const segundoApe = registerForm.segundoApe.value;
        const telefono = registerForm.telefono.value;
        const email = registerForm.email.value;
        const password = registerForm.password.value;
        const rol = "ROLE_TRABAJADOR";

        if (authError) clearError(authError);
        if (authMessage) clearMessage(authMessage);

        try {
            const response = await fetch(REGISTER_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    nombre, primerApellido: primerApe, segundoApellido: segundoApe,
                    numeroTelefono: telefono, rol, email, password, horasSemana: 0, salario: 0
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error en registro');
            }

            if (data.access_token) {
                accessToken = data.access_token;
                if (authMessage) displayMessage(authMessage, 'Registro exitoso!');
                window.location.href = 'landingPage.html';
            } else {
                throw new Error('No se recibió access_token del servidor');
            }
        } catch (err) {
            console.error(err);
            if (authError) displayError(authError, err.message || 'Error al registrarse');
        }
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        try {
            await fetch(LOGOUT_API_URL, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.warn('Error in logout request', err);
        } finally {
            accessToken = null;
            window.location.href = 'index.html';
        }
    });
}

if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => { e.preventDefault();});
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);