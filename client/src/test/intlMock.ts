import { loadMessages } from "@/i18n/loadMessages";

// Components under test render real English strings from messages/en without a provider.
const en = loadMessages("en");
const get = (ns: string | undefined, key: string): string => {
  let cur: unknown = en;
  for (const part of [...(ns ? ns.split(".") : []), ...key.split(".")]) {
    cur = (cur as Record<string, unknown> | undefined)?.[part];
  }
  return typeof cur === "string" ? cur : key;
};
const fill = (s: string, v?: Record<string, unknown>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? `{${k}}`));
const translator = (ns?: string) => {
  const t = (key: string, v?: Record<string, unknown>) => fill(get(ns, key), v);
  t.rich = t; t.raw = (key: string) => get(ns, key);
  return t;
};
export { translator };
