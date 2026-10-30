"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff, Copy, Check, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from "lucide-react";
import { Ring } from "ldrs/react";
//@ts-ignore
import "ldrs/react/Ring.css";
import { ApiEndpointConfig } from "@/interface/systemData/UserPreferences";

export type ProviderOption = {
  value: string;
  label: string;
  base_url: string;
  auth_type: string;
  api_format: string;
};

export const PROVIDER_OPTIONS: ProviderOption[] = [
  { value: "openai", label: "OpenAI", base_url: "https://api.openai.com/v1", auth_type: "bearer", api_format: "openai" },
  { value: "deepseek", label: "DeepSeek", base_url: "https://api.deepseek.com/v1", auth_type: "bearer", api_format: "openai" },
  { value: "ollama", label: "Ollama", base_url: "http://localhost:11434/v1", auth_type: "none", api_format: "openai" },
  { value: "kimi", label: "Kimi (Moonshot)", base_url: "https://api.moonshot.cn/v1", auth_type: "bearer", api_format: "openai" },
  { value: "groq", label: "Groq", base_url: "https://api.groq.com/openai/v1", auth_type: "bearer", api_format: "openai" },
  { value: "mistral", label: "Mistral", base_url: "https://api.mistral.ai/v1", auth_type: "bearer", api_format: "openai" },
  { value: "openrouter", label: "OpenRouter", base_url: "https://openrouter.ai/api/v1", auth_type: "bearer", api_format: "openai" },
  { value: "anthropic", label: "Anthropic (Claude)", base_url: "https://api.anthropic.com/v1", auth_type: "x-api-key", api_format: "anthropic" },
  { value: "gemini", label: "Google Gemini", base_url: "https://generativelanguage.googleapis.com/v1beta", auth_type: "param", api_format: "gemini" },
  { value: "llamacpp", label: "llama.cpp Server", base_url: "http://localhost:8080/v1", auth_type: "none", api_format: "openai" },
  { value: "localai", label: "LocalAI", base_url: "http://localhost:8080/v1", auth_type: "none", api_format: "openai" },
  { value: "elevenlabs", label: "ElevenLabs", base_url: "https://api.elevenlabs.io/v1", auth_type: "x-api-key", api_format: "elevenlabs" },
  { value: "google_tts", label: "Google Cloud TTS", base_url: "https://texttospeech.googleapis.com/v1", auth_type: "param", api_format: "google_tts" },
  { value: "local_tts", label: "Local TTS (Kokoro / Piper)", base_url: "http://localhost:8880/v1", auth_type: "none", api_format: "openai" },
  { value: "custom", label: "Custom", base_url: "", auth_type: "bearer", api_format: "openai" },
];

const TYPE_OPTIONS = [
  { value: "text_gen", label: "Text Generation" },
  { value: "tts", label: "Text-to-Speech" },
  { value: "both", label: "Both" },
  { value: "ocr", label: "Document OCR (vision model)" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  text_gen: "Text Gen",
  tts: "TTS",
  both: "Both",
  ocr: "OCR",
};

// Providers that only do TTS (never text-gen)
// OCR/vision endpoints: only providers that host vision-capable models (OpenAI, Anthropic and Gemini image formats).
// Vision is per-model, not per-provider - "Test connection" is what actually proves it.
const OCR_PROVIDERS = new Set(["openai", "anthropic", "gemini", "mistral", "openrouter", "ollama", "custom"]);

const TTS_ONLY = new Set(["elevenlabs", "google_tts", "local_tts"]);

// Map backend error patterns to user-friendly hints
function friendlyError(error: string): string {
  if (/cannot reach|no route|connection refused|timed out|getaddrinfo/i.test(error)) {
    return "Cannot reach server — check host, port, and that no VPN/proxy is blocking LAN addresses";
  }
  if (/not found|404/i.test(error)) {
    return "Endpoint not found — does your base URL include the correct path (e.g. /v1)?";
  }
  if (/auth|401|403|invalid.*key/i.test(error)) {
    return "Authentication failed — check your API key";
  }
  return error;
}

export default function EndpointCard({
  endpoint,
  index,
  total,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onTestConnection,
  testResult,
  disabled,
  providers = PROVIDER_OPTIONS,
  testing = false,
}: {
  endpoint: ApiEndpointConfig;
  index: number;
  total: number;
  onUpdate: (updated: ApiEndpointConfig) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTestConnection: () => void;
  testResult: { ok: boolean; ms?: number; error?: string; available_models?: string[]; tts_ok?: boolean; text_gen_ok?: boolean; text_gen_error?: string; vision?: string } | null;
  disabled: boolean;
  providers?: ProviderOption[];
  testing?: boolean;
}) {
  const [expanded, setExpanded] = useState(!endpoint.api_type);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!endpoint.api_key) return;
    try {
      await navigator.clipboard.writeText(endpoint.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be denied — silently ignore
    }
  };

  // Filter providers by api_type
  const filteredProviders = useMemo(() => {
    if (!endpoint.api_type || endpoint.api_type === "both") return providers;
    // OCR/vision: the remote OCR engine only speaks the OpenAI image format
    if (endpoint.api_type === "ocr") return providers.filter(p => OCR_PROVIDERS.has(p.value));
    if (endpoint.api_type === "tts") {
      return providers.filter(p => p.value === "custom" || p.value === "local_tts" || p.value === "elevenlabs" || p.value === "google_tts" || p.value === "openai");
    }
    // text_gen: exclude TTS-only providers
    return providers.filter(p => !TTS_ONLY.has(p.value));
  }, [endpoint.api_type, providers]);

  const providerMap = useMemo(() => {
    const map: Record<string, ProviderOption> = {};
    for (const p of providers) map[p.value] = p;
    return map;
  }, [providers]);

  const baseUrlWarning = useMemo(() => {
    if (!endpoint.base_url) return null;
    if (endpoint.base_url.includes("/v1")) return null;
    return "Many providers require /v1 at the end of the base URL.";
  }, [endpoint.base_url]);

  const modelDisabled = !endpoint.base_url;
  const testDisabled = !endpoint.base_url?.trim();
  const modelWarning = modelDisabled ? "Enter a base URL first" : null;
  const testError = testResult && !testResult.ok ? friendlyError(testResult.error ?? "Connection failed") : null;

  const statusBadge = testResult
    ? testResult.ok
      ? { label: `Connected — ${testResult.ms} ms`, color: "var(--color-success)", bg: "var(--color-success)" }
      : { label: "Error", color: "var(--color-danger)", bg: "var(--color-danger)" }
    : endpoint.base_url
      ? { label: "Untested", color: "var(--color-muted)", bg: "var(--color-muted)" }
      : { label: "Unconfigured", color: "var(--color-muted)", bg: "var(--color-muted)" };

  return (
    <div className="endpoint-card card">
      {/* Collapsed header */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp size={16} className="shrink-0 opacity-50" /> : <ChevronDown size={16} className="shrink-0 opacity-50" />}
          <span className="font-medium truncate">{endpoint.name || "Unnamed endpoint"}</span>
          <span className="badge">{TYPE_LABELS[endpoint.api_type ?? ""] ?? endpoint.api_type ?? "Unset"}</span>
        </button>

        <span
          className="badge text-xs"
          style={{ background: statusBadge.bg, color: "#fffbf3" }}
        >
          {statusBadge.label}
        </span>

        {endpoint.is_active && (
          <span className="badge" style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}>
            Active
          </span>
        )}

        {/* Reorder */}
        <div className="flex gap-0.5 ml-auto">
          <button
            type="button"
            className="btn btn-secondary text-xs px-1.5"
            onClick={onMoveUp}
            disabled={disabled || index === 0}
            aria-label="Move up"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            className="btn btn-secondary text-xs px-1.5"
            onClick={onMoveDown}
            disabled={disabled || index === total - 1}
            aria-label="Move down"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="flex flex-col gap-3 pt-3 mt-3 border-t border-dashed border-[var(--color-border)]">

          {/* Step 1: Purpose */}
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-70">Purpose</span>
            <select
              className="input"
              value={endpoint.api_type ?? ""}
              onChange={(e) => {
                const newType = (e.target.value || undefined) as ApiEndpointConfig["api_type"];
                const updates: ApiEndpointConfig = { ...endpoint, api_type: newType };
                // Clear provider if incompatible with new type
                if (newType === "tts" && endpoint.provider && !TTS_ONLY.has(endpoint.provider) && endpoint.provider !== "openai" && endpoint.provider !== "custom") {
                  updates.provider = undefined;
                  updates.base_url = undefined;
                } else if (newType === "ocr" && endpoint.provider && !OCR_PROVIDERS.has(endpoint.provider)) {
                  updates.provider = undefined;
                  updates.base_url = undefined;
                } else if (newType === "text_gen" && endpoint.provider && TTS_ONLY.has(endpoint.provider)) {
                  updates.provider = undefined;
                  updates.base_url = undefined;
                }
                onUpdate(updates);
              }}
              disabled={disabled}
            >
              <option value="">Select purpose…</option>
              {TYPE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          {/* Step 2: Provider (appears after purpose is selected) */}
          {endpoint.api_type && (
            <label className="flex flex-col gap-1">
              <span className="text-sm opacity-70">Provider</span>
              <select
                className="input"
                value={endpoint.provider ?? ""}
                onChange={(e) => {
                  const preset = providerMap[e.target.value];
                  if (preset) {
                    onUpdate({
                      ...endpoint,
                      provider: preset.value,
                      base_url: endpoint.base_url || preset.base_url,
                      api_format: preset.api_format,
                      auth_type: preset.auth_type,
                    });
                  }
                }}
                disabled={disabled}
              >
                <option value="">Select provider…</option>
                {filteredProviders.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          )}

          {/* Step 3: Connection (appears after provider is selected) */}
          {endpoint.provider && (
            <>
              {/* Voice (TTS only) — auto-detected from text language */}
              {(endpoint.api_type === "tts" || endpoint.api_type === "both") && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm opacity-70">Voice</span>
                  <span className="text-xs opacity-40">Voice auto-detected from text language (e.g., Spanish → es_f, French → fr_f).</span>

                  {/* Gender preference (Kokoro-style providers only) */}
                  {endpoint.provider === "local_tts" ? (
                    <div className="flex gap-4 mt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          className="radio-input relative w-4 h-4 rounded-full border-2 cursor-pointer flex-shrink-0 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-hover)] checked:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          name={`voice_gender_${endpoint.name || index}`}
                          value="female"
                          checked={endpoint.voice_gender === "female"}
                          onChange={() => onUpdate({ ...endpoint, voice_gender: "female" })}
                          disabled={disabled}
                        />
                        <span className="text-sm">Female</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          className="radio-input relative w-4 h-4 rounded-full border-2 cursor-pointer flex-shrink-0 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-hover)] checked:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          name={`voice_gender_${endpoint.name || index}`}
                          value="male"
                          checked={endpoint.voice_gender === "male"}
                          onChange={() => onUpdate({ ...endpoint, voice_gender: "male" })}
                          disabled={disabled}
                        />
                        <span className="text-sm">Male</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          className="radio-input relative w-4 h-4 rounded-full border-2 cursor-pointer flex-shrink-0 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-hover)] checked:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          name={`voice_gender_${endpoint.name || index}`}
                          value=""
                          checked={!endpoint.voice_gender}
                          onChange={() => {
                            const { voice_gender, ...rest } = endpoint as any;
                            onUpdate(rest);
                          }}
                          disabled={disabled}
                        />
                        <span className="text-sm">Default</span>
                      </label>
                    </div>
                  ) : (
                    <span className="text-xs opacity-30">Provider voices aren't gender-coded — set an explicit voice override if needed.</span>
                  )}
                </div>
              )}

              {/* Base URL */}
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-70">Base URL</span>
                <input
                  className="input"
                  type="url"
                  value={endpoint.base_url ?? ""}
                  onChange={(e) => onUpdate({ ...endpoint, base_url: e.target.value || undefined })}
                  placeholder="https://api.openai.com/v1"
                  disabled={disabled}
                />
                <span className="text-xs opacity-40">The API root — the app appends /audio/speech or /chat/completions automatically.</span>
                {baseUrlWarning && (
                  <span className="text-xs" style={{ color: "var(--color-warning, #e6a817)" }}>⚠ {baseUrlWarning}</span>
                )}
              </label>

              {/* API Key */}
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-70">API Key</span>
                <div className="relative">
                  <input
                    className="input pr-20"
                    type={showKey ? "text" : "password"}
                    value={endpoint.api_key ?? ""}
                    onChange={(e) => onUpdate({ ...endpoint, api_key: e.target.value || undefined })}
                    placeholder="sk-..."
                    disabled={disabled}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <button
                      type="button"
                      className="p-1 rounded opacity-50 hover:opacity-80"
                      onClick={() => setShowKey(!showKey)}
                      tabIndex={-1}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded opacity-50 hover:opacity-80"
                      onClick={handleCopy}
                      tabIndex={-1}
                      aria-label="Copy API key"
                      disabled={!endpoint.api_key}
                    >
                      {copied ? <Check size={14} color="var(--color-success)" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </label>

              {/* Model + Test Connection */}
              <label className="flex flex-col gap-1">
                <span className="text-sm opacity-70">Model Name</span>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type="text"
                    value={endpoint.model ?? ""}
                    onChange={(e) => onUpdate({ ...endpoint, model: e.target.value || undefined })}
                    placeholder={modelDisabled ? "Enter base URL first" : endpoint.api_type === "ocr" ? "A vision model, e.g. gpt-4o" : "e.g. gpt-4o"}
                    disabled={disabled || modelDisabled}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary text-xs shrink-0"
                    onClick={onTestConnection}
                    disabled={disabled || testDisabled || testing}
                  >
                    {testing ? (
                      <Ring size={14} stroke={2} bgOpacity={0} speed={3} color="var(--color-foreground)" />
                    ) : (
                      "Test connection"
                    )}
                  </button>
                </div>
                {endpoint.api_type === "ocr" && (
                  <span className="text-xs opacity-60">
                    Used only to read pages the local OCR can&apos;t (handwriting, poor scans). The model must accept images; the test sends one.
                  </span>
                )}
                {modelWarning && (
                  <span className="text-xs" style={{ color: "var(--color-warning, #e6a817)" }}>⚠ {modelWarning}</span>
                )}
                {testError && (
                  <span className="text-xs" style={{ color: "var(--color-danger)" }}>
                    ✗ {testError}
                  </span>
                )}
                {testResult?.ok && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs" style={{ color: "var(--color-success)" }}>
                      ✓ {testResult.vision === "reads_images" ? "Connected and reads images" : "Connected"} — {testResult.ms} ms
                    </span>
                    {/* Per-path breakdown for "both" endpoints */}
                    {testResult.tts_ok !== undefined && (
                      <span className="text-xs opacity-60">
                        TTS: {testResult.tts_ok ? "✓" : "✗"} · text-gen: {testResult.text_gen_ok ? "✓" : "✗"}
                        {testResult.text_gen_error ? ` (${testResult.text_gen_error})` : ""}
                      </span>
                    )}
                  </div>
                )}
                {/* Auto-detect model pills (Bug 1 fix: theme-aware colors) */}
                {testResult?.ok && testResult.available_models && testResult.available_models.length > 0 && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-xs opacity-50">Available models — click to select:</span>
                    <div className="flex flex-wrap gap-1">
                      {testResult.available_models.map((fullPath: string) => {
                        const filename = fullPath.split("/").pop() || fullPath;
                        const trimmed = filename.replace(/\.(gguf|bin|pt|safetensors|onnx)$/i, "");
                        const label = trimmed.length > 30
                          ? `${trimmed.slice(0, 14)}…${trimmed.slice(-14)}`
                          : trimmed;
                        return (
                          <button
                            key={fullPath}
                            type="button"
                            className="px-2 py-0.5 text-xs rounded cursor-pointer bg-[var(--color-surface)] text-[var(--color-foreground)] border"
                            style={{ borderColor: endpoint.model === fullPath ? "var(--color-primary)" : "var(--color-border)" }}
                            title={fullPath}
                            onClick={() => onUpdate({ ...endpoint, model: fullPath })}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </label>
            </>
          )}

          {/* Display Name */}
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-70">Display Name</span>
            <input
              className="input"
              type="text"
              value={endpoint.name ?? ""}
              onChange={(e) => onUpdate({ ...endpoint, name: e.target.value })}
              placeholder="e.g. Local Llama"
              disabled={disabled}
            />
          </label>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {!endpoint.is_active ? (
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => onUpdate({ ...endpoint, is_active: true })}
                disabled={disabled}
              >
                Activate
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => onUpdate({ ...endpoint, is_active: false })}
                disabled={disabled}
              >
                Deactivate
              </button>
            )}
            <button
              type="button"
              className="btn btn-danger text-xs ml-auto"
              onClick={onDelete}
              disabled={disabled}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
