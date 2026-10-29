"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import Modal from "@/components/ui/dialogs/modal";
import InviteMenu from "./inviteMenu";

export default function CollaborateButton({ targetType, targetId }: {
  targetType: "language" | "lesson";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
        <Users size={16} aria-hidden /> Collaborate
      </button>
      {open && (
        <Modal
          title="Collaborators"
          subtitle={`Invite people to co-edit this ${targetType}.`}
          onClose={() => setOpen(false)}
        >
          <InviteMenu targetType={targetType} targetId={targetId} />
        </Modal>
      )}
    </>
  );
}
