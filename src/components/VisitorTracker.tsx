'use client';

import { useEffect } from 'react';

function getOrSetVisitorId(): string {
  if (typeof window === 'undefined') return '';

  const STORAGE_KEY = 'drftn_vid';
  let vid = '';

  // 1. Try reading from cookie
  const cookieMatch = document.cookie.match(new RegExp('(?:^|; )' + STORAGE_KEY + '=([^;]*)'));
  if (cookieMatch && cookieMatch[1]) {
    vid = decodeURIComponent(cookieMatch[1]);
  }

  // 2. Try reading from localStorage if cookie absent
  if (!vid) {
    try {
      vid = localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {
      // Storage access blocked
    }
  }

  // 3. Generate new persistent Visitor ID if not found
  if (!vid) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      vid = 'vid_' + crypto.randomUUID().replace(/-/g, '');
    } else {
      vid = 'vid_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }
  }

  // 4. Save across cookie (1 year max-age) and localStorage for max persistence
  try {
    document.cookie = `${STORAGE_KEY}=${encodeURIComponent(vid)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    localStorage.setItem(STORAGE_KEY, vid);
  } catch (e) {
    // Ignore cookie write errors
  }

  return vid;
}

export function VisitorTracker() {
  useEffect(() => {
    const vid = getOrSetVisitorId();
    if (!vid) return;

    const sendHeartbeat = () => {
      fetch('/api/visitors/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vid }),
        keepalive: true,
      }).catch(() => {});
    };

    // Send initial heartbeat on page load
    sendHeartbeat();

    // Periodic heartbeat every 60 seconds while page stays open
    const interval = setInterval(sendHeartbeat, 60000);

    // Send heartbeat when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
}
