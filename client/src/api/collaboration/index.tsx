import { BASE_URL, getAuthHeaders } from "..";

// `query` matches display name, username or email on the server; only display names come back.
export async function listUsers(query = ""): Promise<{ id: string; display_name: string }[]> {
  const res = await fetch(`${BASE_URL}/api/user/list?q=${encodeURIComponent(query)}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list users");
  return res.json();
}

export async function invite(
  collaboratorId: string, targetType: string, targetId: string,
  offer?: { mode: "full" | "partial"; lessonIds?: string[] },
) {
  const res = await fetch(`${BASE_URL}/api/collaboration`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({
      collaborator_id: collaboratorId, target_type: targetType, target_id: targetId,
      mode: offer?.mode, lesson_ids: offer?.mode === "partial" ? offer.lessonIds : undefined,
    }),
  });
  if (!res.ok) {
    // surface the server's reason (e.g. "already shared") instead of a generic failure
    const msg = (await res.json().catch(() => null))?.message as string | undefined;
    throw new Error(msg?.split(": ").slice(1).join(": ") || "Failed to invite");
  }
  return res.json();
}

export async function remove(collaborationId: string) {
  const res = await fetch(`${BASE_URL}/api/collaboration/${collaborationId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove");
  return res.json();
}

export async function accept(collaborationId: string, mode?: "full" | "partial", lessonIds?: string[]) {
  const res = await fetch(`${BASE_URL}/api/collaboration/${collaborationId}/accept`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ mode, lesson_ids: lessonIds }),
  });
  if (!res.ok) throw new Error("Failed to accept");
  return res.json();
}

export async function consent(collaborationId: string) {
  const res = await fetch(`${BASE_URL}/api/collaboration/${collaborationId}/consent`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to consent");
  return res.json();
}

export async function reject(collaborationId: string) {
  const res = await fetch(`${BASE_URL}/api/collaboration/${collaborationId}/reject`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to reject");
  return res.json();
}

export async function listAwaitingConsent(): Promise<{ id: string; collaborator_id: string; collaborator_name?: string; target_id: string; target_type: string; mode: string; language_name?: string | null }[]> {
  const res = await fetch(`${BASE_URL}/api/collaboration/awaiting-consent`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list awaiting consent");
  return res.json();
}

export async function listInvites(): Promise<{ id: string; master_id: string; master_name?: string; target_type: string; target_id: string; proposed_mode?: "full" | "partial" | null; lesson_title?: string | null; language_name?: string; source_language?: string; target_language?: string; lessons?: { id: string; title: string; description?: string; level?: number }[] }[]> {
  const res = await fetch(`${BASE_URL}/api/collaboration/invites`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list invites");
  return res.json();
}

export async function listCollaborators(targetType: string, targetId: string): Promise<{ id: string; collaborator_id: string; status: string; mode?: string | null }[]> {
  const res = await fetch(
    `${BASE_URL}/api/collaboration/list?target_type=${targetType}&target_id=${targetId}`,
    { headers: await getAuthHeaders() },
  );
  if (!res.ok) throw new Error("Failed to list collaborators");
  return res.json();
}

export async function decline(collaborationId: string) {
  const res = await fetch(`${BASE_URL}/api/collaboration/${collaborationId}/decline`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to decline");
  return res.json();
}

export async function listLessonRecipients(lessonId: string): Promise<{ user_id: string; name: string }[]> {
  const res = await fetch(`${BASE_URL}/api/lessons/${lessonId}/collaborators`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list lesson collaborators");
  return res.json();
}

export async function unshareLesson(lessonId: string, userId: string) {
  const res = await fetch(`${BASE_URL}/api/lessons/${lessonId}/share`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error("Failed to stop sharing");
  return res.json();
}

export async function listLanguageLessons(languageId: string): Promise<{ id: string; title: string }[]> {
  const res = await fetch(`${BASE_URL}/api/lessons/all/${languageId}`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list lessons");
  return res.json();
}
