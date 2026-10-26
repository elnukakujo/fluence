import { BASE_URL, getAuthHeaders } from "..";

export async function listBackups() {
  const res = await fetch(`${BASE_URL}/api/backup/list`, {
    method: "GET",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch backups");
  return res.json();
}

export async function createBackup() {
  const res = await fetch(`${BASE_URL}/api/backup/create`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to create backup");
  return res.json();
}

export async function restoreBackup(backupFile: string) {
  const res = await fetch(`${BASE_URL}/api/backup/restore`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ backup_file: backupFile }),
  });
  if (!res.ok) throw new Error("Failed to restore backup");
  return res.json();
}

export async function deleteBackup(backupFile: string) {
  const res = await fetch(`${BASE_URL}/api/backup/delete/${backupFile}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete backup");
  return res.json();
}
