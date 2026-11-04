// ISO 639-2/T (what languages store) -> BCP-47 for the browser voice. Unknown -> undefined (default voice).
const BCP47: Record<string, string> = {
  jpn: "ja", zho: "zh", cmn: "zh", deu: "de", fra: "fr", eng: "en", spa: "es", ita: "it", kor: "ko", por: "pt", rus: "ru",
};

export const bcp47 = (iso639_2t?: string): string | undefined => (iso639_2t ? BCP47[iso639_2t.toLowerCase()] : undefined);

/** Speaks `text` with the browser voice; false when the browser has no speech synthesis. */
export function speak(text: string, lang?: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (lang) {
    u.lang = lang;
    // an installed voice for the language beats the browser default, which would read the characters out one by one
    const voice = window.speechSynthesis.getVoices?.().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
    if (voice) u.voice = voice;
  }
  window.speechSynthesis.speak(u);
  return true;
}
