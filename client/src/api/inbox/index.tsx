import { apiFetch } from "@/api/apiFetch";
import type Exercise from "@/interface/features/Exercise";

export type Inbox = { count: number; groups: { exercise: Exercise[] } };

/** AI-made material waiting for acceptance (excluded from study until then). */
export const getInbox = (): Promise<Inbox> => apiFetch("/api/inbox", { errorMessage: "Could not load the inbox" });
export const acceptDrafts = (ids: string[]): Promise<{ accepted: number }> =>
    apiFetch("/api/inbox/accept", { method: "POST", body: { ids }, errorMessage: "Could not accept" });
export const rejectDrafts = (ids: string[]): Promise<{ rejected: number }> =>
    apiFetch("/api/inbox/reject", { method: "POST", body: { ids }, errorMessage: "Could not reject" });
