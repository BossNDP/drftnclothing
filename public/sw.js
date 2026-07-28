self.addEventListener('push', function(event) {
  if (event.data) {
    let data = {};
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'New Notification', body: event.data.text() };
    }

    // Build type-specific notification options
    // type: 'order'  → new order placed by a customer (admin-only notification)
    // type: 'stock'  → back-in-stock alert
    // type: 'user'   → order status update to a customer
    // (undefined)    → general drop announcement
    const notificationType = data.type || 'general';

    const baseOptions = {
      body: data.body,
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo-cropped.png',
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/',
        type: notificationType,
      },
    };

    let typeOptions = {};
    if (notificationType === 'order') {
      typeOptions = {
        // Distinct vibration pattern for orders: long-short-long
        vibrate: [200, 100, 200, 100, 400],
        // Prevent duplicate order notifications from stacking — collapse into one
        tag: 'drftn-new-order',
        renotify: true,
        requireInteraction: true, // stays on screen until dismissed (desktop)
      };
    } else {
      typeOptions = {
        vibrate: [100, 50, 100],
      };
    }

    const options = { ...baseOptions, ...typeOptions };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Notification', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
