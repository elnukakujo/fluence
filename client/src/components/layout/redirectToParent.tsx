"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Bad URL or failed page (e.g. expired session): walk up one path segment at a time until a page
// renders; "/" is the floor (it shows the login form when logged out), so show a retry there.
export default function RedirectToParent({ reset }: { reset?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const atRoot = pathname === "/";

  useEffect(() => {
    if (!atRoot) router.replace(pathname.replace(/\/[^/]*\/?$/, "") || "/");
  }, [pathname, atRoot, router]);

  if (!atRoot) return null;
  return (
    <main>
      <p>Something went wrong.</p>
      <button onClick={() => (reset ? reset() : router.refresh())}>Try again</button>
    </main>
  );
}
