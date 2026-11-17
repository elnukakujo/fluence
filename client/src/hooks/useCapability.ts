"use client";

import { useEffect, useState } from "react";
import { type Capability, type Feature, getCapabilities } from "@/api/capabilities";

const LOADING: Capability = { enabled: false, reason: null, needs: null };

/** `{enabled, reason, needs}` for one AI feature. While loading (or when the check fails) the feature reads as off, never as an error:
 *  grading, scoring and review do not use this hook. */
export function useCapability(feature: Feature): Capability & { loading: boolean } {
    const [state, setState] = useState<{ cap: Capability; loading: boolean }>({ cap: LOADING, loading: true });
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const all = await getCapabilities();
                if (alive) setState({ cap: all[feature] ?? LOADING, loading: false });
            } catch {
                if (alive) setState({ cap: LOADING, loading: false });
            }
        })();
        return () => { alive = false; };
    }, [feature]);
    return { ...state.cap, loading: state.loading };
}
