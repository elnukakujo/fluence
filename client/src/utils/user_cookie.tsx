'use server'

import { cookies } from 'next/headers'
import { ApiError, apiFetch } from '@/api/apiFetch'

export async function getCurrentUserId(): Promise<string | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value
    if (!token) return null
    try {
        const data = await apiFetch<{ user?: { id?: string } }>('/api/auth/me', { errorMessage: 'Failed to fetch the current user', cache: 'no-store' })
        return data?.user?.id ?? null
    } catch (error) {
        // not signed in (or not any more) is "no user"; a 5xx or a network failure is not, or a hiccup shows the login form to a signed-in user
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null
        throw error
    }
}
