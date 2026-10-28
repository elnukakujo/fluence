"use client";

import { useEffect, useRef, useState } from "react";
import { loadStrokeData, normalizeStrokes, type Stroke } from "@/lib/calligraphy/strokeData";
import { matchStrokes, findClosestStroke } from "@/lib/calligraphy/strokeMatch";

const LOGICAL_SIZE = 1024; // hanzi-writer-data medians live in a ~1024 box
const STROKE_MATCH_THRESHOLD = 150; // max centroid distance (1024-space) for a stroke to count as correct

type Guidance = "none" | "guide" | "order";

function guidanceFor(difficulty: number): Guidance {
  // Fade the scaffold as the element gets easier: numbered order → outline → nothing.
  if (difficulty >= 0.6) return "order";
  if (difficulty >= 0.3) return "guide";
  return "none";
}

export default function CalligraphyPracticeCanvas({
  character,
  difficulty,
  onResult,
}: {
  character: string;
  difficulty: number;
  onResult: (r: { similarity: number; strokeOrderErrors: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [referenceStrokes, setReferenceStrokes] = useState<Stroke[] | null>(null);
  const [userStrokes, setUserStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const [lastStrokeWrong, setLastStrokeWrong] = useState(false);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke>([]);
  const correctCountRef = useRef(0);
  const submittedRef = useRef(false);

  const guidance = guidanceFor(difficulty);

  useEffect(() => {
    let cancelled = false;
    setUserStrokes([]);
    setCurrentStroke([]);
    setLastStrokeWrong(false);
    currentStrokeRef.current = [];
    correctCountRef.current = 0;
    submittedRef.current = false;
    loadStrokeData(character).then((strokes) => {
      if (!cancelled) setReferenceStrokes(strokes);
    });
    return () => {
      cancelled = true;
    };
  }, [character]);

  // Redraw the canvas on every stroke change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width } = canvas;
    const scale = width / LOGICAL_SIZE;
    ctx.clearRect(0, 0, width, width);

    // Reference guide (faint + thick so the jagged medians read as a smooth outline).
    if (referenceStrokes && guidance !== "none") {
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 18;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const stroke of referenceStrokes) {
        drawPolyline(ctx, stroke, scale);
      }
      if (guidance === "order") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        referenceStrokes.forEach((stroke, i) => {
          const start = stroke[0];
          ctx.fillText(String(i + 1), start.x * scale, start.y * scale);
        });
      }
    }

    // User's ink (dark).
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 14;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const stroke of userStrokes) {
      drawPolyline(ctx, stroke, scale);
    }
    if (currentStroke.length > 0) {
      drawPolyline(ctx, currentStroke, scale);
    }
  }, [referenceStrokes, userStrokes, currentStroke, guidance]);

  // Auto-advance once every stroke has been drawn correctly.
  useEffect(() => {
    if (submittedRef.current) return;
    if (referenceStrokes && userStrokes.length > 0 && userStrokes.length === referenceStrokes.length) {
      submittedRef.current = true;
      onResult(matchStrokes(userStrokes, referenceStrokes));
    }
  }, [userStrokes, referenceStrokes, onResult]);

  function toLogical(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_SIZE,
    };
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    drawingRef.current = true;
    currentStrokeRef.current = [toLogical(e)];
    setCurrentStroke([toLogical(e)]);
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    currentStrokeRef.current = [...currentStrokeRef.current, toLogical(e)];
    setCurrentStroke(currentStrokeRef.current);
  }

  function handleUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = [];
    setCurrentStroke([]);
    if (stroke.length === 0 || !referenceStrokes) return;

    // Validate: the next expected stroke, in the right order, close enough.
    const normalized = normalizeStrokes([stroke])[0];
    const { index, distance } = findClosestStroke(normalized, referenceStrokes);
    const correct = index === correctCountRef.current && distance < STROKE_MATCH_THRESHOLD;

    if (correct) {
      correctCountRef.current += 1;
      setUserStrokes((prev) => [...prev, normalized]);
      setLastStrokeWrong(false);
    } else {
      setLastStrokeWrong(true);
    }
  }

  function handleClear() {
    setUserStrokes([]);
    setCurrentStroke([]);
    correctCountRef.current = 0;
    setLastStrokeWrong(false);
  }

  if (referenceStrokes === null) {
    return <p className="text-sm text-muted">No stroke data available for this character.</p>;
  }

  return (
    <div className="flex flex-col gap-3 items-center">
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="border border-border rounded touch-none w-[300px] h-[300px] bg-white"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
      />
      <p className="text-sm text-muted">
        Strokes: {userStrokes.length}{referenceStrokes ? ` / ${referenceStrokes.length}` : ""}
      </p>
      {lastStrokeWrong && <p className="text-sm" style={{ color: "var(--color-danger)" }}>Wrong stroke — try again</p>}
      <div className="flex gap-3">
        <button type="button" className="btn" onClick={handleClear}>
          Clear
        </button>
      </div>
    </div>
  );
}

function drawPolyline(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number) {
  if (stroke.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(stroke[0].x * scale, stroke[0].y * scale);
  for (let i = 1; i < stroke.length; i++) {
    ctx.lineTo(stroke[i].x * scale, stroke[i].y * scale);
  }
  ctx.stroke();
}
