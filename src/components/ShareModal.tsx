'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Copy,
  Check,
  Share2,
  Send,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  priceFormatted: string;
  imageUrl?: string;
  url?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  productName,
  priceFormatted,
  imageUrl,
  url,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareTitle = `${productName} (${priceFormatted}) — DRFTN CLOTHING`;
  const shareText = `Check out ${productName} (${priceFormatted}) on DRFTN CLOTHING!`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const shareOptions = [
    {
      name: 'Copy Link',
      icon: copied ? Check : Copy,
      color: 'bg-zinc-800 text-white hover:bg-zinc-700',
      action: handleCopyLink,
    },
    {
      name: 'WhatsApp',
      icon: Send,
      color: 'bg-emerald-600 text-white hover:bg-emerald-500',
      action: () => {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
        window.open(waUrl, '_blank');
      },
    },
    {
      name: 'Instagram Story',
      icon: ExternalLink,
      color: 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white hover:opacity-90',
      action: () => {
        handleCopyLink();
        toast.info('Link copied! Open Instagram to share to your Story or DM.');
        window.open('https://instagram.com', '_blank');
      },
    },
    {
      name: 'Twitter (X)',
      icon: Share2,
      color: 'bg-black border border-zinc-700 text-white hover:bg-zinc-900',
      action: () => {
        const twUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(twUrl, '_blank');
      },
    },
    {
      name: 'Telegram',
      icon: Send,
      color: 'bg-sky-600 text-white hover:bg-sky-500',
      action: () => {
        const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        window.open(tgUrl, '_blank');
      },
    },
    {
      name: 'Email',
      icon: Mail,
      color: 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white',
      action: () => {
        const mailUrl = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;
        window.open(mailUrl, '_self');
      },
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          {/* Backdrop dismissal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl z-10 text-white overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-850">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-white" />
                <h3 className="text-sm font-display font-black uppercase tracking-wider text-white">
                  Share Garment
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Garment Preview Card */}
            <div className="my-4 p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl flex items-center gap-3">
              {imageUrl && (
                <div className="w-14 h-14 rounded-lg bg-zinc-950 overflow-hidden border border-zinc-800 shrink-0">
                  <img
                    src={imageUrl}
                    alt={productName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-display font-extrabold uppercase tracking-tight text-white truncate">
                  {productName}
                </h4>
                <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                  {priceFormatted}
                </p>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-0.5">
                  DRFTN CLOTHING
                </p>
              </div>
            </div>

            {/* Share Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {shareOptions.map((opt) => {
                const IconComponent = opt.icon;
                return (
                  <motion.button
                    key={opt.name}
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={opt.action}
                    className={`py-3 px-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${opt.color}`}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    <span className="truncate">{opt.name}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Direct Copy Link Bar */}
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-400 pr-24 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="absolute right-1.5 px-3 py-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg text-[10px] font-mono font-extrabold uppercase tracking-wider transition-colors flex items-center gap-1"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
