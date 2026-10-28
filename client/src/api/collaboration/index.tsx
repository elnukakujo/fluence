import { BASE_URL, getAuthHeaders } from "..";

export async function listUsers(): Promise<{ id: string; display_name: string }[]> {
  const res = await fetch(`${BASE_URL}/api/user/list`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list users");
  return res.json();
}

export async function invite(collaboratorId: string, targetType: string, targetId: string) {
  const res = await fetch(`${BASE_URL}/api/collaboration`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ collaborator_id: collaboratorId, target_type: targetType, target_id: targetId }),
  });
  if (!res.ok) throw new Error("Failed to invite");
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

export async function accept(collaborationId: string) {
  const res = await fetch(`${BASE_URL}/api/collaboration/${collaborationId}/accept`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to accept");
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

export async function listInvites(): Promise<{ id: string; master_id: string; target_type: string; target_id: string }[]> {
  const res = await fetch(`${BASE_URL}/api/collaboration/invites`, { headers: await getAuthHeaders() });
  if (!res.ok) throw new Error("Failed to list invites");
  return res.json();
}

export async function listCollaborators(targetType: string, targetId: string): Promise<{ id: string; collaborator_id: string }[]> {
  const res = await fetch(
    `${BASE_URL}/api/collaboration/list?target_type=${targetType}&target_id=${targetId}`,
    { headers: await getAuthHeaders() },
  );
  if (!res.ok) throw new Error("Failed to list collaborators");
  return res.json();
}
