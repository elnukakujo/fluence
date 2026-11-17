import { apiFetch } from "../apiFetch";

// `query` matches display name, username or email on the server; only display names come back.
export async function listUsers(query = ""): Promise<{ id: string; display_name: string }[]> {
  return apiFetch(`/api/user/list?q=${encodeURIComponent(query)}`, { errorMessage: "Failed to list users" });
}

export async function invite(
  collaboratorId: string, targetType: string, targetId: string,
  offer?: { mode: "full" | "partial"; lessonIds?: string[] },
) {
  return apiFetch("/api/collaboration", {
    method: "POST",
    body: {
      collaborator_id: collaboratorId, target_type: targetType, target_id: targetId,
      mode: offer?.mode, lesson_ids: offer?.mode === "partial" ? offer.lessonIds : undefined,
    },
    errorMessage: "Failed to invite",
  });
}

export async function remove(collaborationId: string) {
  return apiFetch(`/api/collaboration/${collaborationId}`, { method: "DELETE", errorMessage: "Failed to remove" });
}

export async function accept(collaborationId: string, mode?: "full" | "partial", lessonIds?: string[]) {
  return apiFetch(`/api/collaboration/${collaborationId}/accept`, {
    method: "POST",
    body: { mode, lesson_ids: lessonIds },
    errorMessage: "Failed to accept",
  });
}

export type MergeChoice = "keep" | "overwrite" | "merge";
export type MergeConflict = { id: string; kind: "word" | "character" | "passage"; key: string; diff: string[]; existing: Record<string, unknown>; incoming: Record<string, unknown> };

/** Approve a full merge. Items that exist on both sides with different content come back as a 409 carrying `body.conflicts`;
 *  the caller asks per item and calls again with `decisions` (incoming element id -> choice). */
export async function consent(collaborationId: string, decisions?: Record<string, MergeChoice>) {
  return apiFetch(`/api/collaboration/${collaborationId}/consent`, { method: "POST", body: decisions ? { decisions } : undefined, errorMessage: "Failed to consent" });
}

export async function reject(collaborationId: string) {
  return apiFetch(`/api/collaboration/${collaborationId}/reject`, { method: "POST", errorMessage: "Failed to reject" });
}

export async function listAwaitingConsent(): Promise<{ id: string; collaborator_id: string; collaborator_name?: string; target_id: string; target_type: string; mode: string; language_name?: string | null }[]> {
  return apiFetch(`/api/collaboration/awaiting-consent`, { errorMessage: "Failed to list awaiting consent" });
}

export async function listInvites(): Promise<{ id: string; master_id: string; master_name?: string; target_type: string; target_id: string; proposed_mode?: "full" | "partial" | null; lesson_title?: string | null; language_name?: string; source_language?: string; target_language?: string; lessons?: { id: string; title: string; description?: string; level?: number }[] }[]> {
  return apiFetch(`/api/collaboration/invites`, { errorMessage: "Failed to list invites" });
}

export async function listCollaborators(targetType: string, targetId: string): Promise<{ id: string; collaborator_id: string; status: string; mode?: string | null }[]> {
  return apiFetch(`/api/collaboration/list?target_type=${targetType}&target_id=${targetId}`, { errorMessage: "Failed to list collaborators" });
}

export async function decline(collaborationId: string) {
  return apiFetch(`/api/collaboration/${collaborationId}/decline`, { method: "POST", errorMessage: "Failed to decline" });
}

export async function listLessonRecipients(lessonId: string): Promise<{ user_id: string; name: string }[]> {
  return apiFetch(`/api/lessons/${lessonId}/collaborators`, { errorMessage: "Failed to list lesson collaborators" });
}

export async function unshareLesson(lessonId: string, userId: string) {
  return apiFetch(`/api/lessons/${lessonId}/share`, {
    method: "DELETE",
    body: { user_id: userId },
    errorMessage: "Failed to stop sharing",
  });
}

export async function listLanguageLessons(languageId: string): Promise<{ id: string; title: string }[]> {
  return apiFetch(`/api/lessons/all/${languageId}`, { errorMessage: "Failed to list lessons" });
}
