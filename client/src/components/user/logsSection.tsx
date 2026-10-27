"use client";

import { useCallback, useEffect, useState } from "react";
import SectionCard from "./sectionCard";
import { fetchLogs } from "@/api/logs";

const LEVEL_CLASS: Record<string, string> = {
  ERROR: "text-danger",
  CRITICAL: "text-danger",
  WARNING: "text-warning",
  INFO: "text-foreground",
  DEBUG: "text-muted",
};

function levelOf(line: string): string | undefined {
  return line.match(/ - (DEBUG|INFO|WARNING|ERROR|CRITICAL) - /)?.[1];
}

export default function LogsSection() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setLogs(await fetchLogs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy logs");
    }
  };

  return (
    <SectionCard title="Logs">
      <p className="text-sm opacity-60">
        Server activity from the current session. Copy these to share when reporting a problem.
      </p>

      <div className="flex items-center gap-2">
        <span className="badge">{logs.length} lines</span>
        <div className="flex-1" />
        <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleCopy} disabled={logs.length === 0}>
          {copied ? "Copied!" : "Copy logs"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          ✗ {error}
        </p>
      )}

      <div
        role="log"
        aria-live="polite"
        className="rounded-lg border border-border bg-background p-3 font-mono text-xs leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap break-words"
      >
        {logs.length === 0 ? (
          <span className="text-muted">No log entries yet.</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={LEVEL_CLASS[levelOf(line) ?? ""] ?? "text-foreground"}>
              {line}
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
