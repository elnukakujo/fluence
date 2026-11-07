"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import ProgressBar from "@/components/ui/progressBar";
import SectionCard from "./sectionCard";
import BackupRow, { Backup } from "./backupRow";
import { createBackup, deleteBackup, listBackups, restoreBackup } from "@/api/backup";

export default function BackupSection() {
  const t = useTranslations("settingsAdmin.backups");
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backupName, setBackupName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const refresh = async () => {
    const data = await listBackups();
    setBackups(data.backups || []);
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      // TODO: replace with API call — pass backupName when backend supports naming
      await createBackup();
      await refresh();
      setShowCreateForm(false);
      setBackupName("");
    } catch (error) {
      console.error("Failed to create backup:", error);
      alert(t("failedCreate"));
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    setLoading(true);
    try {
      await restoreBackup(filename);
    } catch (error) {
      console.error("Failed to restore backup:", error);
      alert(t("failedRestore"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    try {
      await deleteBackup(filename);
      await refresh();
    } catch (error) {
      console.error("Failed to delete backup:", error);
      alert(t("failedDelete"));
    }
  };

  return (
    <SectionCard title={t("title")}>
      {/* Header row with Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm opacity-60">{t("description")}</p>
        {!showCreateForm && backups.length > 0 && (
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() => setShowCreateForm(true)}
            disabled={loading || creating}
          >
            {t("createButton")}
          </button>
        )}
      </div>

      {/* Create backup form */}
      {showCreateForm && (
        <div className="flex flex-col gap-2 p-3 border border-dashed border-[var(--color-border)] rounded-lg">
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-70">{t("backupNameLabel")}</span>
            <input
              className="input"
              type="text"
              value={backupName}
              onChange={(e) => setBackupName(e.target.value)}
              placeholder={t("backupNamePlaceholder")}
              disabled={creating}
            />
          </label>

          {creating && (
            <ProgressBar current={0} total={1} indeterminate showLabel={false} showPercent={false} ariaLabel={t("creating")} />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? t("creating") : t("startBackup")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setShowCreateForm(false); setBackupName(""); }}
              disabled={creating}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {/* Backup list */}
      {backups.length > 0 ? (
        <div className="flex flex-col">
          {backups.map((b) => (
            <BackupRow
              key={b.filename}
              backup={b}
              onRestore={() => handleRestore(b.filename)}
              onDelete={() => handleDelete(b.filename)}
              disabled={loading || creating}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
          <span className="text-4xl opacity-25" aria-hidden="true">📦</span>
          <div>
            <p className="text-sm opacity-50">{t("noBackups")}</p>
            <p className="text-xs opacity-30 mt-1">{t("noBackupsSubtext")}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary mt-2"
            onClick={() => setShowCreateForm(true)}
            disabled={creating}
          >
            {t("createFirstBackup")}
          </button>
        </div>
      )}
    </SectionCard>
  );
}
