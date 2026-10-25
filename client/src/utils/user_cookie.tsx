'use server'

import { cookies } from 'next/headers'
import { BASE_URL } from '@/api'

export async function getCurrentUserId(): Promise<string | null> {
    const cookieStore = await cookies()
    const token = cookieStore.get('session_token')?.value
    if (!token) return null
    try {
        const res = await fetch(`${BASE_URL}/api/auth/me`, {
            headers: { Cookie: `session_token=${token}` },
            cache: 'no-store',
        })
        if (!res.ok) return null
        const data = await res.json()
        return data.user?.id ?? null
    } catch {
        return null
    }
}
