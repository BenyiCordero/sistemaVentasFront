// js/session.js
// Módulo responsable de obtener/guardar perfil de usuario (cache en localStorage).
// Uso: import { getUserProfile, clearUserProfile } from './session.js'

const BASE_API_URL = 'http://127.0.0.1:8081';
const GET_NAME_API_URL = `${BASE_API_URL}/worker/getByEmail`;

// Ajusta TTL según necesidad (por defecto 1 hora)
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

export function readProfileFromCache() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.ts || !parsed?.profile) return null;
        if ((now() - parsed.ts) > CACHE_TTL_MS) {
            // expired
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed.profile;
    } catch (e) {
        console.warn('Cache userProfile parse error', e);
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

// fetch from API and store in cache
export async function fetchUserProfileFromApi() {
    const authToken = localStorage.getItem('authToken');
    const email = localStorage.getItem('email');

    if (!authToken) throw new Error('No authToken (no autenticado)');
    if (!email) throw new Error('No email en localStorage');

    const url = `${GET_NAME_API_URL}?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        }
    });

    if (!res.ok) {
        // intenta extraer mensaje útil
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
    // Normaliza a un objeto de perfil simple
    if (!data || !data.persona) throw new Error('Respuesta inválida de perfil');
    const persona = data.persona;
    const nombre = [
        persona.nombre || '',
        persona.primerApellido || '',
        persona.segundoApellido || ''
    ].map(s => s?.trim()).filter(Boolean).join(' ').trim();

    const profile = {
        nombre,
        nombreSimple: persona.nombre || nombre || '',
        primeros: persona.nombre ? persona.nombre.charAt(0).toUpperCase() : (nombre ? nombre.charAt(0).toUpperCase() : 'U'),
        raw: data
    };

    saveProfileToCache(profile);
    return profile;
}

// función pública: devuelve perfil (desde cache si está fresco, sino fetch)
export async function getUserProfile({ forceRefresh = false } = {}) {
    if (!forceRefresh) {
        const cached = readProfileFromCache();
        if (cached) return cached;
    }
    // si no hay cache o se forzó refresh -> fetch
    const profile = await fetchUserProfileFromApi();
    return profile;
}
