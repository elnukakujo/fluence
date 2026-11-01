"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import ConfirmDialog from "./confirmDialog";

export type Backup = {
  filename: string;
  size_mb: number;
  created_at: string;
  is_latest: boolean;
};

export default function BackupRow({
  backup,
  onRestore,
  onDelete,
  disabled,
}: {
  backup: Backup;
  onRestore: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("settingsAdmin.backups");
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const typeLabels = {
    auto: t("backupType.auto"),
    manual: t("backupType.manual"),
  };
  const type = backup.filename.includes("auto") ? typeLabels.auto : typeLabels.manual;
  const date = new Date(backup.created_at).toLocaleString();

  return (
    <div className="backup-row flex items-center justify-between gap-3 py-3 px-1 border-b border-dashed border-[var(--color-border)] last:border-b-0">
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm truncate" style={{ fontFamily: "var(--font-mono)" }}>
            {backup.filename}
          </span>
          {backup.is_latest && (
            <span className="badge" style={{ background: "var(--color-success)", color: "#fffbf3" }}>
              {t("latest")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs opacity-50">
          <span>{date}</span>
          <span aria-hidden="true">·</span>
          <span>{backup.size_mb} MB</span>
          <span aria-hidden="true">·</span>
          <span className="badge">{type}</span>
        </div>
      </div>

      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          className="btn btn-secondary text-xs"
          onClick={() => setConfirmRestore(true)}
          disabled={disabled}
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">{t("restore")}</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary text-xs"
          disabled
          title={t("notYetImplemented")}
        >
          <Download size={14} />
          <span className="hidden sm:inline">{t("download")}</span>
        </button>
        <button
          type="button"
          className="btn btn-danger text-xs"
          onClick={() => setConfirmDelete(true)}
          disabled={disabled}
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">{t("delete")}</span>
        </button>
      </div>

      {confirmRestore && (
        <ConfirmDialog
          message={t("restoreConfirm", { name: backup.filename })}
          confirmLabel={t("confirmRestore")}
          danger
          onConfirm={() => { setConfirmRestore(false); onRestore(); }}
          onCancel={() => setConfirmRestore(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={t("deleteConfirm", { name: backup.filename })}
          confirmLabel={t("delete")}
          danger
          onConfirm={() => { setConfirmDelete(false); onDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
