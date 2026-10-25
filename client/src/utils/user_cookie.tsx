'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function setUserCookie(userId: string, remember: boolean = false) {
    const cookieStore = await cookies()
    cookieStore.set('selected_user_id', userId, {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        // Session cookie unless "remember me" is checked, then persist for a year.
        ...(remember ? { maxAge: 60 * 60 * 24 * 365 } : {}),
    })
    redirect('/')
}

export async function clearUserCookie() {
    const cookieStore = await cookies()
    cookieStore.delete('selected_user_id')
    redirect('/')
}

export async function getCurrentUserId(): Promise<string | null> {
    const cookieStore = await cookies()
    return cookieStore.get('selected_user_id')?.value ?? null
}