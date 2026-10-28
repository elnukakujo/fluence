"use client";

import { useEffect, useRef, useState } from "react";
import { loadStrokeData, type Stroke } from "@/lib/calligraphy/strokeData";
import { matchStrokes } from "@/lib/calligraphy/strokeMatch";

const LOGICAL_SIZE = 1024; // hanzi-writer-data medians live in a ~1024 box

export default function CalligraphyPracticeCanvas({
  character,
  onResult,
}: {
  character: string;
  onResult: (r: { similarity: number; strokeOrderErrors: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [referenceStrokes, setReferenceStrokes] = useState<Stroke[] | null>(null);
  const [userStrokes, setUserStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke>([]);

  useEffect(() => {
    let cancelled = false;
    setUserStrokes([]);
    setCurrentStroke([]);
    currentStrokeRef.current = [];
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

    const { width, height } = canvas;
    const scale = width / LOGICAL_SIZE;
    ctx.clearRect(0, 0, width, height);

    // Reference guide (faint).
    if (referenceStrokes) {
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 4;
      for (const stroke of referenceStrokes) {
        drawPolyline(ctx, stroke, scale);
      }
    }

    // User's ink (dark).
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 6;
    for (const stroke of userStrokes) {
      drawPolyline(ctx, stroke, scale);
    }
    if (currentStroke.length > 0) {
      drawPolyline(ctx, currentStroke, scale);
    }
  }, [referenceStrokes, userStrokes, currentStroke]);

  function toLogical(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / LOGICAL_SIZE;
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
    if (currentStrokeRef.current.length > 0) {
      setUserStrokes((prev) => [...prev, currentStrokeRef.current]);
      currentStrokeRef.current = [];
      setCurrentStroke([]);
    }
  }

  function handleClear() {
    setUserStrokes([]);
    setCurrentStroke([]);
  }

  function handleSubmit() {
    if (!referenceStrokes) return;
    onResult(matchStrokes(userStrokes, referenceStrokes));
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
      <div className="flex gap-3">
        <button type="button" className="btn" onClick={handleClear}>
          Clear
        </button>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={userStrokes.length === 0}>
          Submit
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
