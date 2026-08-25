"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import { subscribePush, unsubscribePush } from "./actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "checking" | "unsupported" | "off" | "on" | "denied";

export default function PushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "on" : "off");
    }
    check().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setError(null);
    setLoading(true);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Push notifications aren't configured yet.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const result = await subscribePush(json);
      if ("error" in result) throw new Error(result.error);
      setStatus("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable notifications.");
    }
    setLoading(false);
  }

  async function disable() {
    setError(null);
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disable notifications.");
    }
    setLoading(false);
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return (
      <p className="text-sm text-slate-500">
        This browser doesn&rsquo;t support push notifications. On iPhone, add Mahala HQ to your Home Screen first
        (Share → Add to Home Screen), then open it from there and try again.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-red-600">
        Notifications are blocked for this site in your browser settings. Enable them there, then reload this page.
      </p>
    );
  }

  return (
    <div>
      {status === "off" ? (
        <button onClick={enable} disabled={loading} className={buttonClass}>
          {loading ? "Enabling..." : "🔔 Enable notifications on this device"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-teal-700">🔔 Notifications are on for this device</span>
          <button onClick={disable} disabled={loading} className="text-xs font-medium text-slate-500 hover:text-slate-700">
            {loading ? "Turning off..." : "Turn off"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
