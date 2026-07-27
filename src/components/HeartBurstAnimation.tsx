'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

const HEART_PARTICLES = [
  { id: 1, x: -22, y: -45, rotate: -25, scale: 1.0, delay: 0 },
  { id: 2, x: 22, y: -50, rotate: 20, scale: 1.1, delay: 0.04 },
  { id: 3, x: -36, y: -28, rotate: -42, scale: 0.85, delay: 0.02 },
  { id: 4, x: 36, y: -32, rotate: 38, scale: 0.9, delay: 0.05 },
  { id: 5, x: 0, y: -58, rotate: 0, scale: 1.3, delay: 0.01 },
  { id: 6, x: -10, y: -35, rotate: -15, scale: 0.75, delay: 0.06 },
  { id: 7, x: 10, y: -38, rotate: 15, scale: 0.75, delay: 0.03 },
];

interface HeartBurstAnimationProps {
  triggerKey: number | string;
}

export default function HeartBurstAnimation({ triggerKey }: HeartBurstAnimationProps) {
  if (!triggerKey) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
      <AnimatePresence>
        {HEART_PARTICLES.map((p) => (
          <motion.div
            key={`${triggerKey}-${p.id}`}
            initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
            animate={{
              x: p.x,
              y: p.y,
              scale: [0.2, p.scale, 0.3],
              opacity: [1, 1, 0],
              rotate: p.rotate,
            }}
            transition={{
              duration: 0.75,
              delay: p.delay,
              ease: [0.16, 1, 0.3, 1], // GPU smooth cubic-bezier curve
            }}
            className="absolute"
          >
            <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-400 drop-shadow-[0_0_10px_rgba(236,72,153,1)]" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
