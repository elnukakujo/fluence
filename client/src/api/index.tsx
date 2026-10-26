import { deleteLanguage } from "@/api/language";
import { deleteLesson } from "@/api/lesson";
import { deleteCalligraphy } from "@/api/calligraphy";
import { deleteExercise } from "@/api/exercise";
import { deleteGrammar } from "@/api/grammar";
import { deleteVocabulary } from "@/api/vocabulary";
import { deleteTag } from "@/api/tag";
import { deleteSource } from "@/api/source";

// Media is served same-origin through the Next.js server (next.config.ts rewrites
// /media/* to the backend), so media URLs are relative and inherit the site's origin
// and its HTTPS scheme — no hardcoded backend host/port to go stale or leak over HTTP.
export const PUBLIC_BASE_URL = "";

// Server-side code (SSR/route handlers) reaches the backend directly over the internal network.
// LAPP_INTERNAL_HOST/PORT default to localhost for local dev; set them to the compose service
// name ("backend") when running in Docker.
// Client-side code uses a RELATIVE path so requests go same-origin through the Next.js server
// (rewrites in next.config.ts proxy /api/* to the backend) — this is what lets the session cookie
// live on the frontend origin.
export const BASE_URL = typeof window === "undefined"
  ? `http://${process.env.LAPP_INTERNAL_HOST || "127.0.0.1"}:${process.env.LAPP_INTERNAL_PORT || 5050}`
  : "";

// Server-side fetches don't carry the browser's cookies, so forward the
// session_token explicitly. On the client the browser sends it automatically
// (same-origin), so this just returns the Content-Type there.
export async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== 'undefined') return headers;
    try {
        const { cookies } = await import('next/headers');
        const token = (await cookies()).get('session_token')?.value;
        if (token) headers.Cookie = `session_token=${token}`;
    } catch {
        // non-request context (e.g. build): no cookie to forward
    }
    return headers;
}

// ============= Legacy/Compatibility Functions =============
// These functions provide backward compatibility with existing code

export async function deleteElement(element_id: string) {
  // Determine element type from ID prefix and delete accordingly
  if (element_id.toLowerCase().startsWith('lang_')) {
    return deleteLanguage(element_id);
  } else if (element_id.toLowerCase().startsWith('lesson_')) {
    return deleteLesson(element_id);
  } else if (element_id.toLowerCase().startsWith('voc_')) {
    return deleteVocabulary(element_id);
  } else if (element_id.toLowerCase().startsWith('gram_')) {
    return deleteGrammar(element_id);
  } else if (element_id.toLowerCase().startsWith('call_')) {
    return deleteCalligraphy(element_id);
  } else if (element_id.toLowerCase().startsWith('ex_')) {
    return deleteExercise(element_id);
  } else if (element_id.toLowerCase().startsWith('tag_')) {
    return deleteTag(element_id);
  } else if (element_id.toLowerCase().startsWith('src_')) {
    return deleteSource(element_id);
  }
  throw new Error(`Unknown element type for ID: ${element_id}`);
}