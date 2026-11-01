'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, FileText } from "lucide-react";

interface AudioPlayerProps {
    src: string;
    title?: string;
    subtitle?: string;
    level?: 0 | 1 | 2 | 3 | 4 | 5;
    transcript?: string;
    onComplete?: () => void;
}

const LEVEL_KEYS  = ["levelBeginner", "levelElementary", "levelIntermediate", "levelUpperInt", "levelAdvanced", "levelMastery"];
const SPEED_STEPS   = [0.5, 0.75, 1, 1.25, 1.5, 2];
const WAVEFORM_BARS = 38;

const BAR_HEIGHTS = Array.from({ length: WAVEFORM_BARS }, (_, i) =>
    0.2 + Math.abs(Math.sin(i * 0.8) * 0.3 + Math.sin(i * 0.3) * 0.4 + Math.sin(i * 1.7) * 0.3) * 0.8
);

function fmt(secs: number) {
    if (!isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

function Waveform({ progress, onSeek, ariaLabel }: {
    progress: number;
    onSeek: (ratio: number) => void;
    ariaLabel: string;
}) {
    const ref = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onSeek(ratio);
    };

    return (
        <div
            ref={ref}
            className="flex items-center gap-[2px] h-12 w-full cursor-pointer select-none"
            onClick={handleClick}
            role="slider"
            aria-label={ariaLabel}
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            {BAR_HEIGHTS.map((h, i) => {
                const barCenter = (i + 0.5) / WAVEFORM_BARS;
                const filled    = barCenter <= progress;
                return (
                <div
                    key={i}
                    className="flex-1 rounded-full pointer-events-none"
                    style={{
                        height:     `${Math.round(h * 100)}%`,
                        // Use foreground-derived colours that work in both light and dark
                        background: filled ? "var(--accent)" : "var(--foreground)",
                        opacity:    filled ? 1 : 0.15,
                        transition: "background 0.06s, opacity 0.06s",
                    }}
                />
                );
            })}
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AudioPlayer({
  src,
  title,
  subtitle,
  level,
  transcript,
  onComplete,
}: AudioPlayerProps) {
  const t = useTranslations("media");
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing,        setPlaying]        = useState(false);
  const [currentTime,    setCurrentTime]    = useState(0);
  const [duration,       setDuration]       = useState(0);
  const [speedIdx,       setSpeedIdx]       = useState(2);
  const [showTranscript, setShowTranscript] = useState(false);
  const [playCount,      setPlayCount]      = useState(0);

  const progress  = duration > 0 ? currentTime / duration : 0;
  const hasHeader = !!title || level !== undefined;

  // ── Audio events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncDuration = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(audio.duration); // fill bar completely on end
      setPlayCount((n) => n + 1);
      onComplete?.();
    };

    // durationchange + loadedmetadata both cover different browser timings
    audio.addEventListener("durationchange",  syncDuration);
    audio.addEventListener("loadedmetadata",  syncDuration);
    audio.addEventListener("ended",           onEnded);

    // If metadata already loaded by the time this effect runs
    if (isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener("durationchange", syncDuration);
      audio.removeEventListener("loadedmetadata", syncDuration);
      audio.removeEventListener("ended",          onEnded);
    };
  }, [onComplete]);

  // ── progress updates via the audio element's own timeupdate event ────────
  // (avoids an rAF loop forcing a React re-render every frame while playing)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    audio.addEventListener("timeupdate", onTimeUpdate);
    return () => audio.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = SPEED_STEPS[speedIdx];
  }, [speedIdx]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else         { audio.play();  setPlaying(true);  }
  }, [playing]);

  // Read duration directly from the element — never rely on stale closure value
  const seekByRatio = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    if (!dur) return;
    audio.currentTime = ratio * dur;
    setCurrentTime(audio.currentTime);
    if (!isFinite(duration) || duration === 0) setDuration(dur);
  }, [duration]);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = Math.max(0, Math.min(dur, audio.currentTime + delta));
    setCurrentTime(audio.currentTime);
  }, []);

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  };

  return (
    <div
        className="w-full min-w-[8rem] max-w-[32rem] bg-accent-soft rounded-lg p-3 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
    >

      {hasHeader && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <div className={`ap-reel ${playing ? "spinning" : ""}`}>
              <div className="ap-reel-hub" />
            </div>

            <div className="flex-1 min-w-0">
              {title && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-serif font-semibold text-base text-foreground truncate">
                    {title}
                  </span>
                  {level !== undefined && (
                    <span className={`badge level-${level}`} style={{ fontSize: "0.68rem" }}>
                      {t(LEVEL_KEYS[level])}
                    </span>
                  )}
                </div>
              )}
              {subtitle && <p className="text-xs text-muted mt-0.5 truncate">{subtitle}</p>}
            </div>

            <div className={`ap-reel ap-reel-reverse ${playing ? "spinning" : ""}`}>
              <div className="ap-reel-hub" />
            </div>
          </div>
          <div className="index-divider" />
        </>
      )}

      <div className="mt-2 mb-1">
        <Waveform progress={progress} onSeek={seekByRatio} ariaLabel={t("waveformSliderAriaLabel")} />
      </div>

      <div className="flex justify-between font-mono text-[0.7rem] text-muted mb-3">
        <span>{fmt(currentTime)}</span>
        <span>{fmt(duration)}</span>
      </div>

      <div className="flex items-center justify-center gap-3 mb-3">
        <button type="button" className="btn btn-secondary !p-2 !rounded-full" onClick={() => skip(-5)} aria-label={t("audioPlayerSkipBack")}>
          <SkipBack size={16} />
        </button>

        <button type="button" className="ap-play-btn" onClick={togglePlay} aria-label={playing ? t("audioPlayerPause") : t("audioPlayerPlay")}>
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button type="button" className="btn btn-secondary !p-2 !rounded-full" onClick={() => skip(5)} aria-label={t("audioPlayerSkipForward")}>
          <SkipForward size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.7rem] text-muted">
          {playCount === 0
            ? t("audioPlayerNotYetPlayed")
            : t("audioPlayerPlayedCount", { count: playCount })
          }
        </span>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary !p-2 !rounded-full" onClick={restart} aria-label={t("audioPlayerRestart")}>
            <RotateCcw size={14} />
          </button>

          <button
            type="button"
            className="badge cursor-pointer font-mono text-[0.72rem] hover:bg-accent hover:text-primary-foreground transition-colors"
            onClick={() => setSpeedIdx((i) => (i + 1) % SPEED_STEPS.length)}
            aria-label={t("audioPlayerPlaybackSpeed")}
          >
            {SPEED_STEPS[speedIdx]}×
          </button>

          {transcript && (
            <button
              type="button"
              className="badge cursor-pointer hover:bg-accent hover:text-primary-foreground transition-colors flex items-center gap-1"
              onClick={() => setShowTranscript((v) => !v)}
              aria-expanded={showTranscript}
              aria-label={t("audioPlayerToggleTranscript")}
            >
              <FileText size={12} /> {t("audioPlayerScript")}
            </button>
          )}
        </div>
      </div>

      {transcript && (
        <div className={`ap-transcript ${showTranscript ? "open" : ""}`}>
          <div className="mt-3 p-3 rounded-[0.6rem] bg-accent-soft text-sm leading-relaxed text-foreground overflow-y-auto max-h-40">
            {transcript}
          </div>
        </div>
      )}

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}