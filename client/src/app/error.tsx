"use client";

import RedirectToParent from "@/components/layout/redirectToParent";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <RedirectToParent reset={reset} />;
}
