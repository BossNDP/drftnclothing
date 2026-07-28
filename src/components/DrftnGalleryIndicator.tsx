'use client';

/**
 * DrftnGalleryIndicator — DRFTN Signature Gallery Indicator
 *
 * Premium morphing capsule navigation that replaces standard dot / label pagination.
 * Built with Framer Motion layout animations for zero-stutter morphing.
 *
 * Features:
 * - Morphing capsule (spring physics, layoutId)
 * - Accent color derived from product variant
 * - Autoplay progress fill (left→right sweep)
 * - Breathing on active dot only (scale 1→1.04→1, 8s)
 * - First-load animation (once, 600ms)
 * - Scroll fade via IntersectionObserver
 * - Reduced-motion safe
 * - Full keyboard + screen-reader accessibility
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
  RefObject,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface DrftnGalleryIndicatorProps {
  /** Total number of slides */
  total: number;
  /** Currently active slide index */
  activeIndex: number;
  /** Product accent colour string, e.g. "Deep Red", "Royal Blue", "White" */
  accentColor?: string;
  /** True while autoplay interval is running */
  isAutoplayRunning: boolean;
  /**
   * Progress 0-1 through the current autoplay cycle.
   * Reset to 0 when activeIndex changes, reaches 1 at end of cycle.
   */
  autoplayProgress: number;
  /** Forward from parent's reducedMotion state */
  reducedMotion: boolean;
  /** Callback when a dot is tapped/clicked */
  onSelect: (index: number) => void;
  /**
   * Ref to the gallery wrapper — used to observe scroll visibility so the
   * indicator fades out when the gallery leaves the viewport.
   */
  galleryRef: RefObject<HTMLElement | null>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Accent Colour Resolver
// ─────────────────────────────────────────────────────────────────────────────
function resolveAccentHex(color?: string): string {
  if (!color) return '#FFFFFF';
  const c = color.toLowerCase();

  if (c.includes('white') || c.includes('cream') || c.includes('ivory') || c.includes('light'))
    return '#FFFFFF';
  if (c.includes('navy') || c.includes('indigo'))
    return '#2563EB';
  if (c.includes('blue'))
    return '#3B82F6';
  if (c.includes('crimson') || c.includes('burgundy'))
    return '#7F1D1D';
  if (c.includes('red'))
    return '#991B1B';
  if (c.includes('forest') || c.includes('olive'))
    return '#166534';
  if (c.includes('green'))
    return '#15803D';
  if (c.includes('grey') || c.includes('gray'))
    return '#9CA3AF';
  if (c.includes('brown') || c.includes('tan') || c.includes('camel'))
    return '#92400E';
  if (c.includes('purple') || c.includes('violet') || c.includes('plum'))
    return '#7C3AED';
  if (c.includes('pink') || c.includes('rose'))
    return '#DB2777';
  if (c.includes('orange') || c.includes('amber'))
    return '#D97706';
  if (c.includes('yellow') || c.includes('gold'))
    return '#CA8A04';
  if (c.includes('teal') || c.includes('cyan'))
    return '#0D9488';

  // black / dark — use white capsule on dark backgrounds
  return '#FFFFFF';
}

// ─────────────────────────────────────────────────────────────────────────────
// Spring config — feels snappy, never rubber-banded
// ─────────────────────────────────────────────────────────────────────────────
const CAPSULE_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

// ─────────────────────────────────────────────────────────────────────────────
// Single Dot
// ─────────────────────────────────────────────────────────────────────────────
interface DotProps {
  index: number;
  total: number;
  isActive: boolean;
  accentHex: string;
  isAutoplayRunning: boolean;
  autoplayProgress: number;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}

const Dot = memo(function Dot({
  index,
  total,
  isActive,
  accentHex,
  isAutoplayRunning,
  autoplayProgress,
  reducedMotion,
  onSelect,
}: DotProps) {
  const systemReducedMotion = useReducedMotion();
  const noMotion = reducedMotion || !!systemReducedMotion;

  // Breathing animation — active capsule only, very subtle
  const breathingAnim =
    isActive && !noMotion
      ? {
          scale: [1, 1.04, 1],
          transition: {
            duration: 8,
            ease: 'easeInOut' as const,
            repeat: Infinity,
            repeatType: 'loop' as const,
          },
        }
      : { scale: 1 };

  return (
    <motion.button
      onClick={() => onSelect(index)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(index);
        }
      }}
      aria-label={`Go to image ${index + 1} of ${total}`}
      aria-current={isActive ? 'true' : undefined}
      role="tab"
      tabIndex={0}
      className="relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full"
      style={{ WebkitTapHighlightColor: 'transparent', minWidth: 16, minHeight: 20 }}
      animate={breathingAnim}
    >
      {isActive ? (
        /* Active capsule */
        <motion.div
          layoutId="drftn-active-capsule"
          layout
          transition={noMotion ? { duration: 0 } : CAPSULE_SPRING}
          className="relative overflow-hidden"
          style={{
            width: 40,
            height: 6,
            borderRadius: 9999,
            backgroundColor: accentHex,
          }}
        >
          {/* Autoplay fill overlay */}
          {isAutoplayRunning && !noMotion && (
            <motion.div
              key={`fill-${index}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: autoplayProgress }}
              transition={{ duration: 0.08, ease: 'linear' }}
              className="absolute inset-0 rounded-full"
              style={{
                backgroundColor: 'rgba(0,0,0,0.25)',
                transformOrigin: 'left',
              }}
            />
          )}
        </motion.div>
      ) : (
        /* Inactive dot */
        <motion.div
          layoutId={`drftn-dot-${index}`}
          layout
          transition={noMotion ? { duration: 0 } : CAPSULE_SPRING}
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            backgroundColor: 'rgba(255,255,255,0.42)',
          }}
        />
      )}
    </motion.button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Indicator Component
// ─────────────────────────────────────────────────────────────────────────────
function DrftnGalleryIndicator({
  total,
  activeIndex,
  accentColor,
  isAutoplayRunning,
  autoplayProgress,
  reducedMotion,
  onSelect,
  galleryRef,
}: DrftnGalleryIndicatorProps) {
  const systemReducedMotion = useReducedMotion();
  const noMotion = reducedMotion || !!systemReducedMotion;

  const accentHex = resolveAccentHex(accentColor);

  // First-load animation — runs once on mount
  const [firstLoadVisible, setFirstLoadVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFirstLoadVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // Scroll fade via IntersectionObserver
  const [scrollOpacity, setScrollOpacity] = useState(1);
  useEffect(() => {
    const target = galleryRef?.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[0]?.intersectionRatio ?? 1;
        if (ratio >= 0.5) setScrollOpacity(1);
        else if (ratio >= 0.1) setScrollOpacity(0.35);
        else setScrollOpacity(0);
      },
      { threshold: [0, 0.1, 0.4, 0.5, 1] }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [galleryRef]);

  if (total <= 1) return null;

  return (
    <motion.div
      animate={{ opacity: scrollOpacity }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      // Mobile: absolute above bottom edge; Desktop: relative, centered below gallery
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 md:relative md:bottom-auto md:left-auto md:translate-x-0 md:mt-5 flex items-center justify-center"
      aria-label="Gallery navigation"
      role="tablist"
    >
      <AnimatePresence>
        {firstLoadVisible && (
          <motion.div
            key="drftn-indicator-row"
            initial={noMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              noMotion
                ? { duration: 0 }
                : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
            }
            className="flex items-center gap-[10px] px-1"
          >
            {Array.from({ length: total }).map((_, idx) => (
              <Dot
                key={idx}
                index={idx}
                total={total}
                isActive={activeIndex === idx}
                accentHex={accentHex}
                isAutoplayRunning={isAutoplayRunning}
                autoplayProgress={autoplayProgress}
                reducedMotion={noMotion}
                onSelect={onSelect}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default memo(DrftnGalleryIndicator);
