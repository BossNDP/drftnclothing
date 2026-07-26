'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

const CYCLING_WORDS = ['DRIFTERS.', 'OUTLIERS.', 'UNBOTHERED.', 'RESTLESS.'];

const MINI_COLLAGE_PHOTOS = [
  {
    src: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=700&q=80',
    alt: 'Garment Heavyweight Cotton Texture',
    initialRotation: -12,
    finalRotation: -5,
    initialX: -40,
    initialY: 30,
    className: 'w-24 sm:w-36 md:w-44 aspect-[3/4] shadow-2xl rounded-none border border-white/20 z-10',
  },
  {
    src: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=700&q=80',
    alt: 'Garment Tag & Stitching Detail',
    initialRotation: 14,
    finalRotation: 6,
    initialX: 40,
    initialY: -20,
    className: 'w-28 sm:w-40 md:w-48 aspect-square shadow-2xl rounded-none border border-white/20 z-20 -ml-6 -mt-4 sm:-ml-10',
  },
  {
    src: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=700&q=80',
    alt: 'Heavy Hoodie Cut Detail',
    initialRotation: -6,
    finalRotation: -2,
    initialX: 0,
    initialY: 45,
    className: 'w-24 sm:w-36 md:w-44 aspect-[4/5] shadow-2xl rounded-none border border-white/20 z-30 -ml-4 mt-6 sm:-ml-8',
  },
];

export default function BrandStorySection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const photosRef = useRef<(HTMLDivElement | null)[]>([]);
  const [wordIndex, setWordIndex] = useState(0);

  // Cycling words timer — visibility-gated via IntersectionObserver so timer pauses when off-screen
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const sectionEl = sectionRef.current;

    const startTimer = () => {
      if (!timer) {
        timer = setInterval(() => {
          setWordIndex((prev) => (prev + 1) % CYCLING_WORDS.length);
        }, 2200);
      }
    };

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (typeof IntersectionObserver !== 'undefined' && sectionEl) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            startTimer();
          } else {
            stopTimer();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(sectionEl);
      return () => {
        stopTimer();
        observer.disconnect();
      };
    } else {
      startTimer();
      return () => stopTimer();
    }
  }, []);

  // GSAP Scroll-scrubbed assembly animation
  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(min-width: 320px)', () => {
        photosRef.current.forEach((el, idx) => {
          if (!el) return;
          const config = MINI_COLLAGE_PHOTOS[idx];

          gsap.fromTo(
            el,
            {
              x: config.initialX,
              y: config.initialY,
              rotation: config.initialRotation,
              scale: 0.85,
              opacity: 0.3,
            },
            {
              x: 0,
              y: 0,
              rotation: config.finalRotation,
              scale: 1,
              opacity: 1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: sectionRef.current,
                start: 'top 85%',
                end: 'top 35%',
                scrub: 1,
              },
            }
          );
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full py-12 sm:py-16 md:py-20 bg-zinc-950 text-white overflow-hidden z-10 border-b border-white/10 flex flex-col justify-center min-h-[50vh] max-h-[70vh]"
    >
      {/* Subtle ambient spotlight glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.06)_0%,transparent_75%)] pointer-events-none" />

      <div className="max-w-screen-xl mx-auto px-4 sm:px-8 md:px-12 w-full flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 relative z-10">
        
        {/* 1. Staggered Overlapping Mini-Collage Cluster */}
        <div className="flex items-center justify-center relative py-4 sm:py-6">
          {MINI_COLLAGE_PHOTOS.map((photo, idx) => (
            <div
              key={idx}
              ref={(el) => {
                photosRef.current[idx] = el;
              }}
              className={`${photo.className} relative overflow-hidden bg-zinc-900 shadow-black/80 hover:z-40 transition-all duration-300`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                loading="lazy"
                sizes="200px"
                className="object-cover filter grayscale contrast-125 brightness-90 hover:brightness-100 hover:grayscale-0 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            </div>
          ))}
        </div>

        {/* 2. Integrated Manifesto & Cycling Headline */}
        <div className="flex-1 text-center md:text-left space-y-4 max-w-2xl">
          <h2 className="text-2xl sm:text-4xl md:text-6xl font-black font-display uppercase tracking-tighter text-white leading-[1.05]">
            BUILT FOR THE{' '}
            <span className="inline-block relative min-w-[150px] sm:min-w-[240px] md:min-w-[310px] text-zinc-300">
              <AnimatePresence mode="wait">
                <motion.span
                  key={CYCLING_WORDS[wordIndex]}
                  initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 top-0 text-white underline decoration-white/40 underline-offset-4"
                >
                  {CYCLING_WORDS[wordIndex]}
                </motion.span>
              </AnimatePresence>
              <span className="opacity-0 select-none pointer-events-none">
                UNBOTHERED.
              </span>
            </span>
          </h2>

          <p
            className="text-xl sm:text-3xl md:text-4xl font-display font-black uppercase tracking-tighter text-zinc-200 leading-[1.1]"
            style={{
              textShadow: '0 2px 14px rgba(255, 255, 255, 0.15)',
            }}
          >
            WE DON&apos;T FOLLOW CULTURE.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              WE BUILD IT.
            </span>
          </p>
        </div>

      </div>
    </section>
  );
}
