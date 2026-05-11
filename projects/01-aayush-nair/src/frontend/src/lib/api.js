/**
 * api.js — Centralized API client for the Socratic Tutor frontend
 *
 * Provides a fetch wrapper that:
 *   1. Attaches the current session token to every request
 *   2. Handles 401 (expired/invalid token) by calling onUnauthorized
 *   3. Returns the parsed JSON body or throws a typed error
 *
 * Usage:
 *   import { createApiClient } from '../lib/api'
 *   const api = createApiClient(token, handleLogout)
 *   const data = await api.get('/sessions/recent')
 *   const data = await api.post('/quiz/start', { topic, count })
 */

const API_BASE = 'http://localhost:8000'

/**
 * Build authorization headers for a request.
 * The token comes from the session stored by App.jsx —
 * never hard-coded or stored separately.
 *
 * @param {string} token - JWT session token from user context
 * @param {boolean} [isFormData] - set true to skip Content-Type (let browser set multipart boundary)
 * @returns {Record<string, string>}
 */
export function buildHeaders(token, isFormData = false) {
    const headers = { Authorization: `Bearer ${token}` }
    if (!isFormData) headers['Content-Type'] = 'application/json'
    return headers
}

/**
 * Create a typed API client bound to the current user's token.
 *
 * @param {string} token - JWT session token
 * @param {function} onUnauthorized - called when the backend returns 401
 *                                    (should log out the user and redirect)
 * @returns {{ get, post, upload }}
 */
export function createApiClient(token, onUnauthorized) {
    /**
     * Core fetch wrapper — used by all methods.
     */
    async function request(path, options = {}) {
        const url = path.startsWith('http') ? path : `${API_BASE}${path}`

        let response
        try {
            response = await fetch(url, options)
        } catch (networkErr) {
            throw new Error(`Network error: ${networkErr.message}`)
        }

        // Handle expired / invalid tokens globally
        if (response.status === 401) {
            const body = await response.json().catch(() => ({}))
            // Backend returns either a string detail or {error, message} object
            const detail = typeof body.detail === 'object'
                ? body.detail?.message || body.detail?.error || 'Unauthorized'
                : body.detail || body.error || 'Unauthorized'
            console.warn(`[API] 401 — ${detail}. Logging out.`)
            onUnauthorized?.()
            throw new Error(detail)
        }

        if (!response.ok) {
            const body = await response.json().catch(() => ({}))
            throw new Error(body.detail || `HTTP ${response.status}`)
        }

        return response.json()
    }

    return {
        /** GET request */
        get(path) {
            return request(path, {
                method: 'GET',
                headers: buildHeaders(token),
            })
        },

        /** POST request with JSON body */
        post(path, body) {
            return request(path, {
                method: 'POST',
                headers: buildHeaders(token),
                body: JSON.stringify(body),
            })
        },

        /** DELETE request */
        delete(path) {
            return request(path, {
                method: 'DELETE',
                headers: buildHeaders(token),
            })
        },

        /** POST request with FormData (file uploads) */
        upload(path, formData) {
            return request(path, {
                method: 'POST',
                headers: buildHeaders(token, true),
                body: formData,
            })
        },
    }
}
