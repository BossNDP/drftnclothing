import React from 'react';
import Image from 'next/image';

export const metadata = {
  title: 'Under Construction | DRFTN CLOTHING',
  description: "We'll be back shortly.",
};

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center select-none font-mono">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        {/* DRFTN Branding / Logo */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="text-4xl md:text-5xl font-black uppercase tracking-[0.4em] pl-[0.4em] text-white">
            DRFTN
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold border-b border-zinc-850 pb-4 w-full">
            Clothing &middot; High Streetwear
          </div>
        </div>

        {/* Message */}
        <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-2xl space-y-4 shadow-2xl">
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto text-xl">
            🛠️
          </div>
          <h1 className="text-xl font-bold uppercase tracking-widest text-white">
            Under Construction
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed font-mono">
            We are upgrading our drop systems. We&apos;ll be back shortly.
          </p>
          <div className="pt-2">
            <span className="inline-block text-[9px] uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-zinc-500">
              System Maintenance Active
            </span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-zinc-650 tracking-wider uppercase">
          &copy; {new Date().getFullYear()} DRFTN CLOTHING. All rights reserved.
        </p>
      </div>
    </main>
  );
}
