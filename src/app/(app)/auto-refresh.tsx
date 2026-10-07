"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Other people in the household are marking chores done, approving points, requesting rewards,
// adding calendar events, etc. from their own devices -- without this, everyone's screen goes
// stale until they remember to manually reload. router.refresh() re-fetches the current page's
// server data in place (no full page reload, so scroll position and anything being typed
// elsewhere on the page are undisturbed).
const REFRESH_MS = 30_000;

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    function refreshIfVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }

    // Poll while the tab is open and visible, and also refresh immediately whenever it becomes
    // visible/focused again -- that covers the common case of switching back to the app (or
    // waking the phone) after it sat in the background for a while.
    const interval = setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [router]);

  return null;
}
