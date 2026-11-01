"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import Modal from "@/components/ui/dialogs/modal";
import InviteMenu from "./inviteMenu";

export default function CollaborateButton({ targetType, targetId }: {
  targetType: "language" | "lesson";
  targetId: string;
}) {
  const t = useTranslations("collaboration");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        <Users size={16} aria-hidden /> {t("collaborate")}
      </button>
      {open && (
        <Modal
          title={t("collaborators")}
          subtitle={t("invitePeople", { type: targetType })}
          onClose={() => setOpen(false)}
        >
          <InviteMenu targetType={targetType} targetId={targetId} />
        </Modal>
      )}
    </>
  );
}
