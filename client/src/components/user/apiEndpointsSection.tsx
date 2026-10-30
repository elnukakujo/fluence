"use client";

import { useState, useEffect } from "react";
import SectionCard from "./sectionCard";
import EndpointCard, { ProviderOption, PROVIDER_OPTIONS as FALLBACK_PROVIDERS } from "./endpointCard";
import SaveButton from "./saveButton";
import ConfirmDialog from "./confirmDialog";
import { updateUserPreferences } from "@/api/userPreferences";
import { BASE_URL } from "@/api";
import { ApiEndpointConfig } from "@/interface/systemData/UserPreferences";

export default function ApiEndpointsSection({
  prefId,
  endpoints: initial,
}: {
  prefId: string;
  endpoints: ApiEndpointConfig[];
}) {
  const [endpoints, setEndpoints] = useState<ApiEndpointConfig[]>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; ms?: number; error?: string; available_models?: string[]; tts_ok?: boolean; text_gen_ok?: boolean; text_gen_error?: string; vision?: string } | null>>({});
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>(FALLBACK_PROVIDERS);
  const [testingIdx, setTestingIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/pref/providers`)
      .then((r) => r.json())
      .then((data: ProviderOption[]) => {
        if (Array.isArray(data) && data.length > 0) setProviders(data);
      })
      .catch(() => {}); // fall back to hardcoded list
  }, []);

  const persist = async (updated: ApiEndpointConfig[]) => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateUserPreferences(prefId, { ai_endpoints: updated });
      setEndpoints(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save endpoints");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const ep: ApiEndpointConfig = {
      is_active: endpoints.length === 0,
      api_format: "openai",
      auth_type: "bearer",
    };
    setEndpoints([...endpoints, ep]);
  };

  const handleUpdate = (idx: number, updated: ApiEndpointConfig) => {
    const prev = endpoints[idx];
    setEndpoints(endpoints.map((e, i) => (i === idx ? updated : e)));
    if (prev && (prev.base_url !== updated.base_url || prev.api_format !== updated.api_format || prev.provider !== updated.provider)) {
      setTestResults((prev) => ({ ...prev, [idx]: null }));
    }
  };

  const handleDelete = (idx: number) => {
    setDeleteIdx(idx);
  };

  const confirmDelete = async () => {
    if (deleteIdx === null) return;
    const updated = endpoints.filter((_, i) => i !== deleteIdx);
    await persist(updated);
    setDeleteIdx(null);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...endpoints];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setEndpoints(updated);
  };

  const handleMoveDown = (idx: number) => {
    if (idx === endpoints.length - 1) return;
    const updated = [...endpoints];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setEndpoints(updated);
  };

  const handleTestConnection = async (idx: number) => {
    const ep = endpoints[idx];
    if (!ep.base_url) {
      setTestResults((prev) => ({ ...prev, [idx]: { ok: false, error: "No base URL configured" } }));
      return;
    }
    setTestingIdx(idx);
    setTestResults((prev) => ({ ...prev, [idx]: null })); // clear while testing
    const start = performance.now();
    try {
      // Proxy through backend to avoid browser CORS blocking local-network IPs
      const res = await fetch(`${BASE_URL}/api/pref/test-endpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: ep.base_url,
          api_key: ep.api_key,
          model: ep.model ?? "",
          api_format: ep.api_format ?? "openai",
          auth_type: ep.auth_type ?? "bearer",
          api_type: ep.api_type ?? "text_gen",
        }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [idx]: data }));
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      setTestResults((prev) => ({ ...prev, [idx]: { ok: false, ms, error: err instanceof Error ? err.message : "Connection failed" } }));
    } finally {
      // ponytail: 300ms delay prevents spinner flicker on fast responses;
      // functional update guards against a stale timeout clearing a newer test.
      setTimeout(() => setTestingIdx((cur) => (cur === idx ? null : cur)), 300);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    await persist(endpoints);
  };

  return (
    <SectionCard title="API Endpoints">
      <p className="text-sm opacity-60">
        Manage your LLM API connections. Only the active endpoint of each type is used.
      </p>

      {endpoints.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center" role="status">
          <span className="text-3xl opacity-30" aria-hidden="true">⚡</span>
          <p className="text-sm opacity-40">No endpoints configured yet.</p>
          <button type="button" className="btn btn-secondary mt-1" onClick={handleAdd}>
            Configure your first endpoint
          </button>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="flex flex-col gap-3">
        {endpoints.map((ep, idx) => (
          <EndpointCard
            key={idx}
            endpoint={ep}
            index={idx}
            total={endpoints.length}
            onUpdate={(updated) => handleUpdate(idx, updated)}
            onDelete={() => handleDelete(idx)}
            onMoveUp={() => handleMoveUp(idx)}
            onMoveDown={() => handleMoveDown(idx)}
            onTestConnection={() => handleTestConnection(idx)}
            testResult={testResults[idx] ?? null}
            disabled={saving}
            providers={providers}
            testing={testingIdx === idx}
          />
        ))}

        {saveError && (
          <p className="text-sm" style={{ color: "var(--color-danger)" }} role="alert">
            ✗ {saveError}
          </p>
        )}

        {endpoints.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAdd}
              disabled={saving}
            >
              + Add Endpoint
            </button>
            <div className="flex-1" />
            <SaveButton isLoading={saving} onSuccessLabel="Endpoints saved" />
          </div>
        )}
      </form>

      {deleteIdx !== null && (
        <ConfirmDialog
          message={`Delete "${endpoints[deleteIdx]?.name || "this endpoint"}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteIdx(null)}
        />
      )}
    </SectionCard>
  );
}
