// js/session.js
const BASE_API_URL = 'http://127.0.0.1:8081';
const GET_NAME_API_URL = `${BASE_API_URL}/worker/getByEmail`;

const CACHE_TTL_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'userProfileCache';

function now() { return Date.now(); }

function saveProfileToCache(profile) {
    const payload = { ts: now(), profile };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearUserProfile() {
    localStorage.removeItem(STORAGE_KEY);
}

export function readProfileFromCache(allowStale = false) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.ts || !parsed?.profile) return null;
        if ((now() - parsed.ts) > CACHE_TTL_MS) {
            if (!allowStale) {
                localStorage.removeItem(STORAGE_KEY);
                return null;
            }
            // Return stale cache as fallback
            return parsed.profile;
        }
        return parsed.profile;
    } catch (e) {
        console.warn('Cache userProfile parse error', e);
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

async function fetchUserProfileFromApiInternal(retry = false, attempt = 0) {
    const maxRetries = 3;
    const authToken = localStorage.getItem('authToken');
    const email = localStorage.getItem('email');

    if (!authToken) throw new Error('No authToken (no autenticado)');
    if (!email) throw new Error('No email en localStorage');

    const url = `${GET_NAME_API_URL}?email=${encodeURIComponent(email)}`;
    let res;
    try {
        res = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });
    } catch (fetchError) {
        // Network error, retry
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Backoff
            return fetchUserProfileFromApiInternal(retry, attempt + 1);
        }
        throw new Error('Network error after retries');
    }

    if (!res.ok) {
        if (res.status === 401 && !retry) {
            // Try refresh token
            await refreshToken();
            // Retry with new token
            return fetchUserProfileFromApiInternal(true, 0);
        }
        // For other errors, if not 401, maybe retry if it's server error
        if (res.status >= 500 && attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
            return fetchUserProfileFromApiInternal(retry, attempt + 1);
        }
        let txt = `Status ${res.status}`;
        try {
            const obj = await res.json();
            txt = obj.message || JSON.stringify(obj);
        } catch (e) {
            const t = await res.text();
            if (t) txt = t;
        }
        throw new Error(txt);
    }

    const data = await res.json();
    if (!data || !data.persona) throw new Error('Respuesta inválida de perfil');
    const persona = data.persona;
    const nombre = [
        persona.nombre || '',
        persona.primerApellido || '',
        persona.segundoApellido || ''
    ].map(s => s?.trim()).filter(Boolean).join(' ').trim();

    const profile = {
        id: data.idUsuario,
        email: data.email,
        rol: data.rol,
        nombre: persona.nombre || '',
        primerApellido: persona.primerApellido || '',
        segundoApellido: persona.segundoApellido || '',
        nombreCompleto: nombre,
        nombreSimple: persona.nombre || '',
        primeros: persona.nombre ? persona.nombre.charAt(0).toUpperCase() : (nombre ? nombre.charAt(0).toUpperCase() : 'U'),
        telefono: persona.numeroTelefono,
        idSucursal: data.sucursal?.idSucursal,
        sucursalNombre: data.sucursal?.nombre,
        sucursalKey: data.sucursal?.sucursalKey,
        raw: data
    };

    saveProfileToCache(profile);
    return profile;
}

export async function fetchUserProfileFromApi() {
    return fetchUserProfileFromApiInternal();
}

export async function refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');

    const res = await fetch(`${BASE_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!res.ok) {
        if (res.status === 401) {
            // Refresh failed, logout
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            window.location.href = 'index.html';
            throw new Error('Session expired, logged out');
        }
        throw new Error(`Refresh failed: ${res.status}`);
    }

    const data = await res.json();
    localStorage.setItem('authToken', data.access_token);
    if (data.refresh_token) {
        localStorage.setItem('refreshToken', data.refresh_token);
    }
    return data.access_token;
}

export async function getUserProfile({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
        const cached = readProfileFromCache();
        if (cached) return cached;
    }
    try {
        const profile = await fetchUserProfileFromApi();
        return profile;
    } catch (e) {
        // Fallback to stale cache if fetch fails
        const stale = readProfileFromCache(true);
        if (stale) return stale;
        throw e; // Re-throw if no fallback
    }
}