'use client';

import { useEffect, useState } from 'react';

/**
 * IntroLoader — CSS-compositor driven splash screen.
 *
 * CRITICAL PERFORMANCE DESIGN:
 * 1. Uses pure CSS animation (`drftnIntroFadeOut`) to drive opacity/visibility/pointer-events.
 *    The CSS compositor thread executes this animation independently of main-thread JS congestion,
 *    guaranteeing it fades out at ~400ms regardless of CPU throttling or long JS tasks.
 * 2. `onAnimationEnd` cleans up the React DOM node afterwards.
 * 3. SessionStorage check ensures returning users pay 0ms cost.
 * 4. Since this component is dynamically imported with `{ ssr: false }`, it has 0 SSR impact.
 */
export default function IntroLoader() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem('drftn_intro_seen');
      if (!seen) {
        sessionStorage.setItem('drftn_intro_seen', 'true');
        setShouldRender(true);
      }
    } catch {
      // In case cookies/sessionStorage are disabled by privacy settings
    }
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      onClick={() => setShouldRender(false)}
      onAnimationEnd={() => setShouldRender(false)}
      style={{
        animation: 'drftnIntroFadeOut 350ms cubic-bezier(0.22, 1, 0.36, 1) 220ms forwards',
        willChange: 'opacity, transform',
      }}
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center cursor-pointer select-none"
    >
      <style jsx>{`
        @keyframes drftnIntroFadeOut {
          0% {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
          }
          100% {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
          }
        }
      `}</style>
      <div className="flex gap-2 md:gap-4 items-center justify-center font-display font-black uppercase text-5xl md:text-8xl tracking-normal text-white">
        {['D', 'R', 'F', 'T', 'N'].map((char, index) => (
          <span
            key={index}
            style={{
              animation: `drftnCharPop 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * 30}ms both`,
            }}
            className="inline-block"
          >
            {char}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes drftnCharPop {
          0% {
            opacity: 0;
            transform: translateY(15px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
