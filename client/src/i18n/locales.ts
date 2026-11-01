export const LOCALES = ["en", "fr", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_TO_ISO: Record<Locale, string> = { en: "eng", fr: "fra", zh: "zho" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function pickLocale(cookie: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(cookie)) return cookie;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.split("-")[0].toLowerCase(), q: q ? parseFloat(q.slice(2)) : 1, i };
    })
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked.map((r) => r.lang).find(isLocale) ?? DEFAULT_LOCALE;
}

export function suggestedLocales(nativeIsos: string[]): Locale[] {
  return LOCALES.filter((l) => nativeIsos.includes(LOCALE_TO_ISO[l]));
}

export function nativeFromLocale(locale: Locale): string[] {
  return [LOCALE_TO_ISO[locale]];
}
