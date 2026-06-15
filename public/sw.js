// FGA HR Portal service worker — handles incoming Web Push messages and clicks.
// (No offline caching: this only powers push notifications.)

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "FGA HR Portal", body: event.data.text() };
  }

  const title = data.title || "FGA HR Portal";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [80, 40, 80],
    data: { url: data.url || "/dashboard/notifications" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    "/dashboard/notifications";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // Re-use an open tab if there is one, navigating it to the target.
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && client.url !== targetUrl) {
              client.navigate(targetUrl).catch(function () {});
            }
            return;
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});
