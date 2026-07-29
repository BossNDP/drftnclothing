'use client';

import { motion, Variants } from 'framer-motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
}

/**
 * ScrollReveal — lightweight Client Component wrapper that gives any Server Component
 * children a `framer-motion` whileInView fade-up without forcing those children to
 * hydrate on the client. The heavy child DOM stays server-rendered.
 */
export default function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 20,
  duration = 0.5,
}: ScrollRevealProps) {
  const customVariants: Variants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      variants={customVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
