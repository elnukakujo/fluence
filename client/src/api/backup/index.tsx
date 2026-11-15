import { apiFetch } from "../apiFetch";

export async function listBackups() {
  return apiFetch(`/api/backup/list`, { errorMessage: "Failed to fetch backups" });
}

export async function createBackup() {
  return apiFetch(`/api/backup/create`, { method: "POST", errorMessage: "Failed to create backup" });
}

export async function restoreBackup(backupFile: string) {
  return apiFetch(`/api/backup/restore`, {
    method: "POST",
    body: { backup_file: backupFile },
    errorMessage: "Failed to restore backup",
  });
}

export async function deleteBackup(backupFile: string) {
  return apiFetch(`/api/backup/delete/${backupFile}`, { method: "DELETE", errorMessage: "Failed to delete backup" });
}
