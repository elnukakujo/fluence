import Link from "next/link";
import type { Capability } from "@/api/capabilities";

/** Why an AI feature is off, with the way out (Settings). Shown instead of hiding the control; renders nothing when enabled. */
export default function DisabledReason({ capability, settingsHref = "/user", linkLabel }: {
    capability: Pick<Capability, "enabled" | "reason" | "needs">;
    settingsHref?: string;
    linkLabel?: string;
}) {
    if (capability.enabled || !capability.reason) return null;
    return (
        <p className="text-sm text-muted">
            {capability.reason}{" "}
            {capability.needs !== "switch" && linkLabel && <Link href={settingsHref} className="link">{linkLabel}</Link>}
        </p>
    );
}
