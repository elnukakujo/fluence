import fs from "node:fs";
import path from "node:path";

// messages/<locale>/<namespace>.json -> { namespace: {...} }. One file per namespace so
// areas can be translated independently without merge conflicts.
export function loadMessages(locale: string): Record<string, unknown> {
  const dir = path.join(process.cwd(), "messages", locale);
  return Object.fromEntries(
    fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [
      f.slice(0, -5),
      JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")),
    ]),
  );
}
