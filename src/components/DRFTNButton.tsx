'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface DRFTNButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
  className?: string;
  icon?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export default function DRFTNButton({
  children,
  href,
  onClick,
  variant = 'primary',
  fullWidth = false,
  className = '',
  icon = (
    <ArrowRight className="w-4 h-4 transition-transform duration-300 ease-out group-hover:translate-x-1.5 flex-shrink-0" />
  ),
  type = 'button',
  disabled = false,
}: DRFTNButtonProps) {
  const baseClasses = `
    relative group inline-flex items-center justify-center gap-2.5 sm:gap-3
    min-h-[52px] sm:min-h-[56px] px-6 sm:px-8 py-3.5 sm:py-4 rounded-[2px]
    font-mono font-bold text-[12px] sm:text-[13px] md:text-[14px] tracking-[0.16em] sm:tracking-[0.18em] uppercase
    select-none overflow-hidden transition-all duration-300 ease-out
    active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none
    ${fullWidth ? 'w-full' : 'w-full sm:w-auto'}
    ${className}
  `;

  const variantClasses = {
    primary: `
      bg-[#F5F5F0] text-black border border-[#F5F5F0]
      shadow-[0_4px_24px_rgba(255,255,255,0.2)]
      hover:bg-[#EAEAE5] hover:border-[#EAEAE5]
    `,
    secondary: `
      bg-transparent text-[#F5F5F0] border-[1.5px] border-[#F5F5F0]/50
      hover:border-[#F5F5F0] hover:bg-[#F5F5F0]/10
      shadow-[inset_0_0_0_0px_rgba(255,255,255,0)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]
    `,
    outline: `
      bg-transparent text-white/80 border border-zinc-800
      hover:border-zinc-500 hover:text-white hover:bg-zinc-900/60
    `,
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]}`;

  const content = (
    <>
      {/* Primary Fill Wipe Layer (scaleX 0 -> 1 left-to-right sweep on hover) */}
      {variant === 'primary' && (
        <span
          className="absolute inset-0 bg-black/10 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Button label */}
      <span className="relative z-10 font-bold whitespace-nowrap">{children}</span>

      {/* Icon */}
      {icon && <span className="relative z-10">{icon}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={combinedClasses} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={combinedClasses} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}
