"use client";

import { leaveSharedLesson } from "@/api/lesson";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";

export default function StopSharingButton({ lesson_id }: { lesson_id: string }) {
    const [confirming, setConfirming] = useState(false);
    const router = useRouter();

    const handleLeave = async () => {
        try {
            await leaveSharedLesson(lesson_id);
            router.push(window.location.pathname.split("/lesson/")[0]);
        } catch (error) {
            console.error("Failed to stop sharing:", error);
        }
    };

    return (
        <div>
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-secondary">
                Stop sharing
            </button>
            {confirming && createPortal(
                <div className="fixed inset-0 z-50 flex flex-col gap-3 items-center justify-center bg-black/60 backdrop-blur-sm">
                    <p className="text-white">Stop collaborating on this lesson? You will lose access to it.</p>
                    <div className="flex flex-row gap-2">
                        <button type="button" onClick={handleLeave} className="btn btn-danger">
                            Confirm
                        </button>
                        <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary">
                            Cancel
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
