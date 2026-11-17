import { ApiEndpointConfig } from "@/interface/systemData/UserPreferences";

const norm = (url: string) => url.trim().replace(/\/+$/, "");

/** Base URLs of active endpoints whose one-time "this provider receives your text" notice was not acknowledged yet. */
export function unseenProviders(endpoints: ApiEndpointConfig[], seen: string[]): string[] {
    const known = new Set(seen.map(norm));
    const urls = endpoints.filter((e) => e.is_active && e.base_url).map((e) => norm(e.base_url!));
    return [...new Set(urls)].filter((u) => !known.has(u));
}
