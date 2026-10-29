"use client";

import { leaveSharedLesson } from "@/api/lesson";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import ConfirmDialog from "@/components/user/confirmDialog";

export default function StopSharingButton({ lesson_id }: { lesson_id: string }) {
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLeave = async () => {
        setConfirming(false);
        try {
            await leaveSharedLesson(lesson_id);
            router.push(window.location.pathname.split("/lesson/")[0]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to leave this lesson");
        }
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-secondary">
                <LogOut size={16} aria-hidden /> Leave lesson
            </button>
            {error && <p role="alert" className="text-xs" style={{ color: "var(--color-danger)" }}>{error}</p>}
            {confirming && (
                <ConfirmDialog
                    danger
                    confirmLabel="Leave"
                    message="Leave this shared lesson? You will lose access to it, and the owner can invite you again."
                    onConfirm={handleLeave}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
}
