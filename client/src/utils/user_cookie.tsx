'use server'

import { cookies } from 'next/headers'
import { apiFetch } from '@/api/apiFetch'

export async function getCurrentUserId(): Promise<string | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value
    if (!token) return null
    try {
        const data = await apiFetch<{ user?: { id?: string } }>('/api/auth/me', { errorMessage: 'Failed to fetch the current user', cache: 'no-store' })
        return data?.user?.id ?? null
    } catch {
        return null
    }
}
