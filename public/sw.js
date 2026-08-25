self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();
  const options = {
    body: payload.body || "",
    icon: "/icon",
    badge: "/badge-icon",
    data: { url: payload.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(payload.title || "Mahala HQ", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
