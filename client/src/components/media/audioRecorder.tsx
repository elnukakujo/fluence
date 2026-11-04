"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";
import { uploadAudio } from "@/api/process";

// ── Register the WAV encoder once (no-op if already registered) ───────────────

let encoderReady: Promise<void> | null = null;

function getEncoderReady(): Promise<void> {
    if (!encoderReady) {
        encoderReady = connect().then(register);
    }
    return encoderReady;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "idle" | "recording" | "processing" | "uploading" | "done" | "error";

interface AudioRecorderProps {
    onUploadSuccess?: (response: unknown) => void;
    onUploadError?:   (error: unknown)    => void;
    /** Keep the take in the browser only (no upload); `onRecorded` gets the local preview URL. */
    localOnly?: boolean;
    onRecorded?: (previewUrl: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudioRecorder({ onUploadSuccess, onUploadError, localOnly, onRecorded }: AudioRecorderProps) {
    const t = useTranslations("media");
    const [status, setStatus] = useState<Status>("idle");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState<string>("");

    const previewUrlRef = useRef<string | null>(null);
    const mediaRecorderRef = useRef<InstanceType<typeof MediaRecorder> | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const isRecording = status === "recording";
    const isProcessing = status === "processing" || status === "uploading";
    const hasRecording = !!previewUrl && (status === "uploading" || status === "done" || status === "error");

    function revokePreview() {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
        }
    }

    const startRecording = async () => {
        revokePreview();
        setPreviewUrl(null);
        setErrorMsg("");
        chunksRef.current = [];

        // Ensure the WAV encoder worker is registered before recording
        await getEncoderReady();

        const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
            },
        });

        // extendable-media-recorder records directly to audio/wav —
        // no manual encoding, no decodeAudioData, no cross-browser hacks needed
        const recorder = new MediaRecorder(stream, { mimeType: "audio/wav" });
        mediaRecorderRef.current = recorder;

        recorder.addEventListener("dataavailable", (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        });

        recorder.addEventListener("stop", async () => {
            stream.getTracks().forEach((t) => t.stop());
            setStatus("processing");

            try {
                const wavBlob = new Blob(chunksRef.current, { type: "audio/wav" });
                const url     = URL.createObjectURL(wavBlob);
                previewUrlRef.current = url;
                setPreviewUrl(url);

                if (localOnly) {
                    setStatus("done");
                    onRecorded?.(url);
                    return;
                }
                const file = new File([wavBlob], "recording.wav", { type: "audio/wav" });
                setStatus("uploading");

                uploadAudio(file, true)
                    .then((res) => { setStatus("done");  onUploadSuccess?.(res); })
                    .catch((err) => { setStatus("error"); onUploadError?.(err);  });

            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error("[AudioRecorder] error:", msg);
                setErrorMsg(msg);
                setStatus("error");
            }
        });

        recorder.start(100);
        setStatus("recording");
    };

    const stopRecording = () => mediaRecorderRef.current?.stop();

    useEffect(() => () => revokePreview(), []);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div 
            className="flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
        >
            <div className="flex gap-3 items-center">

                {!isRecording ? (
                    <button
                        type="button"
                        onClick={startRecording}
                        disabled={isProcessing}
                        className="btn btn-danger"
                    >
                        🎙 {hasRecording ? t("audioRecorderReRecord") : t("audioRecorderRecord")}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={stopRecording}
                        className="btn btn-secondary"
                    >
                        ⏹ {t("audioRecorderStop")}
                    </button>
                )}

                {status === "processing" && (
                    <span className="text-sm text-muted animate-pulse">{t("audioRecorderEncodingAudio")}</span>
                )}
                {status === "uploading" && (
                    <span className="text-sm text-muted animate-pulse">{t("audioRecorderUploading")}</span>
                )}

                {hasRecording && (
                    <audio src={previewUrl!} controls className="h-9" />
                )}
            </div>

            {status === "error" && (
                <span className="text-sm text-danger">
                    {t("audioRecorderError", { error: errorMsg || t("audioRecorderCheckConsole") })}
                </span>
            )}
        </div>
    );
}