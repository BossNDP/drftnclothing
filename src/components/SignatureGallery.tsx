'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SignatureGalleryProps {
  images: string[];
  activeIndex: number;
  onChangeIndex?: (index: number) => void;
  aspectClass?: string;
  sizes?: string;
  enableDrag?: boolean;
  enableHoverScrub?: boolean;
  overlayLeft?: React.ReactNode;
  overlayRight?: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  layoutId?: string;
  imageWidth?: number;
  autoSlideInterval?: number; // default 4500ms
}

function PremiumImage({
  src,
  alt,
  sizes,
  imageWidth,
  priority = false,
  isActive,
}: {
  src: string;
  alt: string;
  sizes?: string;
  imageWidth: number;
  priority?: boolean;
  isActive: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const optimizedUrl = getOptimizedImageUrl(src, imageWidth);

  return (
    <div
      aria-hidden={!isActive}
      className="absolute inset-0 w-full h-full"
      style={{
        opacity: isActive ? 1 : 0,
        transition: 'opacity 0.25s ease-out',
        willChange: 'opacity',
        pointerEvents: isActive ? 'auto' : 'none',
      }}
    >
      <NextImage
        src={optimizedUrl}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        className="object-cover select-none pointer-events-none"
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s ease-out',
        }}
      />
    </div>
  );
}

export default function SignatureGallery({
  images,
  activeIndex,
  onChangeIndex,
  aspectClass = 'aspect-[3/4]',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  overlayLeft,
  overlayRight,
  onClick,
  imageWidth = 1200,
  autoSlideInterval = 0,
}: SignatureGalleryProps) {
  const [localIndex, setLocalIndex] = useState(activeIndex || 0);
  const dragStartX = useRef(0);
  const isDragging = useRef(false);
  const pausedUntilRef = useRef<number>(0);

  // Sync prop index with local index when controlled by parent
  useEffect(() => {
    if (activeIndex !== undefined && activeIndex !== localIndex) {
      setLocalIndex(activeIndex);
    }
  }, [activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = useCallback((next: number) => {
    if (next < 0 || next >= images.length) return;
    setLocalIndex(next);
    onChangeIndex?.(next);
  }, [images.length, onChangeIndex]);

  // Pause auto-sliding on touch / interaction for 7 seconds
  const pauseAutoSlide = useCallback(() => {
    pausedUntilRef.current = Date.now() + 7000;
  }, []);

  // Auto-sliding interval — only runs if autoSlideInterval > 0
  useEffect(() => {
    if (images.length <= 1 || !autoSlideInterval || autoSlideInterval <= 0) return;

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() < pausedUntilRef.current) return;
      const nextIdx = (localIndex + 1) % images.length;
      setLocalIndex(nextIdx);
      onChangeIndex?.(nextIdx);
    }, autoSlideInterval);

    return () => clearInterval(timer);
  }, [images.length, autoSlideInterval, localIndex, onChangeIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pauseAutoSlide();
    dragStartX.current = e.clientX;
    isDragging.current = true;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const delta = e.clientX - dragStartX.current;
    if (Math.abs(delta) > 35) {
      goTo(localIndex + (delta < 0 ? 1 : -1));
    }
  };

  const handleMouseEnter = () => {
    // Only perform default hover image toggle if parent is not controlling activeIndex via onChangeIndex
    if (!onChangeIndex && images.length > 1) {
      setLocalIndex(1);
    }
  };

  const handleMouseLeave = () => {
    // Only perform default hover image toggle if parent is not controlling activeIndex via onChangeIndex
    if (!onChangeIndex) {
      setLocalIndex(0);
    }
  };

  if (images.length === 0) {
    return <div className={`w-full ${aspectClass} bg-[#111]`} />;
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={pauseAutoSlide}
      className={`relative w-full ${aspectClass} overflow-hidden bg-[#0d0d0d] group select-none`}
      style={{ touchAction: 'pan-y' }}
    >
      {images.map((src, idx) => (
        <PremiumImage
          key={src}
          src={src}
          alt={`Product image ${idx + 1}`}
          sizes={sizes}
          imageWidth={imageWidth}
          priority={idx === 0}
          isActive={idx === localIndex}
        />
      ))}

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at 50% 60%, transparent 50%, rgba(0,0,0,0.2) 100%)',
        }}
      />

      {/* Animated pill dots */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-[5px]">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                pauseAutoSlide();
                goTo(idx);
              }}
              className="h-[4px] rounded-full bg-white cursor-pointer"
              style={{
                width: idx === localIndex ? 20 : 6,
                opacity: idx === localIndex ? 1 : 0.4,
                transition: 'width 0.28s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease',
                minWidth: 6,
              }}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Overlays */}
      {overlayLeft && (
        <div className="absolute bottom-3 left-3 z-20 pointer-events-none">{overlayLeft}</div>
      )}
      {overlayRight && (
        <div className="absolute top-3 right-3 z-20 pointer-events-none">{overlayRight}</div>
      )}

      {/* Desktop nav arrows */}
      {localIndex > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            pauseAutoSlide();
            goTo(localIndex - 1);
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-40 w-9 h-9
            bg-black/50 border border-white/10 rounded-none
            flex items-center justify-center text-white
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            backdrop-blur-sm hidden md:flex cursor-pointer"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
      )}

      {localIndex < images.length - 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            pauseAutoSlide();
            goTo(localIndex + 1);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-40 w-9 h-9
            bg-black/50 border border-white/10 rounded-none
            flex items-center justify-center text-white
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            backdrop-blur-sm hidden md:flex cursor-pointer"
          aria-label="Next image"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
