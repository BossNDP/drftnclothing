'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown, ChevronUp, ShieldCheck, Lock, RefreshCw, CheckCircle, Bell } from 'lucide-react';
import { toast } from '@/lib/toast';

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const PinterestIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <line x1="12" x2="12" y1="8" y2="16" />
    <line x1="8" x2="16" y1="12" y2="12" />
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 2.78 2.78 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);

const PaymentIcons = () => (
  <div className="flex items-center gap-2 flex-wrap" aria-label="Accepted payment methods">
    {['VISA', 'MASTERCARD', 'RUPAY', 'UPI', 'PAYTM', 'GPAY', 'COD'].map((pay) => (
      <div key={pay} className="h-5 px-2 bg-brand-graphite border border-brand-muted/40 rounded flex items-center">
        <span className="text-[8px] font-bold tracking-wider text-brand-silver font-mono">{pay}</span>
      </div>
    ))}
  </div>
);

const TrustBadges = () => (
  <div className="flex items-center gap-4 flex-wrap text-zinc-500 text-[9px] uppercase tracking-wider font-bold font-mono">
    <span className="flex items-center gap-1">
      <ShieldCheck className="w-3.5 h-3.5 text-brand-red flex-shrink-0" /> 100% Secure Checkout
    </span>
    <span className="flex items-center gap-1">
      <Lock className="w-3.5 h-3.5 text-brand-red flex-shrink-0" /> SSL Secured
    </span>
    <span className="flex items-center gap-1">
      <RefreshCw className="w-3.5 h-3.5 text-brand-red flex-shrink-0" /> Easy Returns
    </span>
  </div>
);

export default function Footer({ standalone }: { standalone?: boolean }) {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  
  // Mobile accordion toggle state
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

  // Push Notification state
  const [subscribed, setSubscribed] = useState<boolean | 'unsupported'>(false);

  React.useEffect(() => {
    const checkSubscription = async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setSubscribed('unsupported');
        return;
      }
      const localSub = localStorage.getItem('push_alerts_subscribed') === 'true';
      if (localSub) {
        setSubscribed(true);
        return;
      }
      if (Notification.permission === 'granted') {
        try {
          const registration = await navigator.serviceWorker.ready;
          const sub = await registration.pushManager.getSubscription();
          if (sub) {
            localStorage.setItem('push_alerts_subscribed', 'true');
            setSubscribed(true);
          } else {
            setSubscribed(false);
          }
        } catch (e) {
          setSubscribed(false);
        }
      } else {
        setSubscribed(false);
      }
    };

    checkSubscription();

    window.addEventListener('push-subscription-changed', checkSubscription);
    return () => {
      window.removeEventListener('push-subscription-changed', checkSubscription);
    };
  }, []);

  const handleSubscribe = () => {
    if (subscribed === 'unsupported') return;
    if (Notification.permission === 'denied') {
      toast.error('Notification permission is blocked. Please enable it in browser settings.');
      return;
    }
    window.dispatchEvent(new Event('show-push-prompt'));
  };

  if (pathname?.startsWith('/admin')) return null;
  if (pathname?.startsWith('/shop/') && !standalone) return null;

  const toggleAccordion = (sectionName: string) => {
    setActiveAccordion(prev => prev === sectionName ? null : sectionName);
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success("You're on the list! Welcome to the inner circle.");
    setEmail('');
  };

  const shopLinks = [
    { label: 'New Arrivals', href: '/shop?sort=newest' },
    { label: 'Men Apparel', href: '/shop?gender=men' },
    { label: 'Women Apparel', href: '/shop?gender=women' },
    { label: 'Best Sellers', href: '/shop?sort=featured' },
    { label: 'Store Sale', href: '/shop' }
  ];

  const customerLinks = [
    { label: 'Contact Support', href: '/contact' },
    { label: 'Track Order', href: '/track' },
    { label: 'Shipping & Delivery Policy', href: '/policies/shipping-policy' },
    { label: 'Refund & Return Policy', href: '/policies/refund-policy' },
    { label: 'Cancellation Policy', href: '/policies/cancellation-policy' },
    { label: 'Store Disclaimer', href: '/policies/disclaimer' }
  ];

  const companyLinks = [
    { label: 'About Us', href: '/about' },
    { label: 'DRFTN Store Bengaluru', href: '/contact' },
    { label: 'Grievance Redressal', href: '/policies/grievance-redressal-policy' },
    { label: 'Bulk Orders', href: '/contact' }
  ];

  const legalLinks = [
    { label: 'Terms & Conditions', href: '/policies/terms-and-conditions' },
    { label: 'Privacy Policy', href: '/policies/privacy-policy' },
    { label: 'Refund & Return Policy', href: '/policies/refund-policy' },
    { label: 'Shipping & Delivery Policy', href: '/policies/shipping-policy' },
    { label: 'Cookie Policy', href: '/policies/cookie-policy' }
  ];

  return (
    <footer className="bg-[#080808] border-t border-zinc-900 text-zinc-300 text-sm mt-auto pb-16 md:pb-0 relative z-20">
      
      {/* ── Main Footer Layout ── */}
      <div className="max-w-screen-2xl mx-auto px-6 md:px-12 py-12 md:py-20 flex flex-col lg:flex-row gap-12 lg:gap-16">
        
        {/* Column 1: Brand details (Tagline, Socials & Newsletter) - spans larger area */}
        <div className="flex-1 lg:max-w-sm space-y-6">
          <Link href="/" className="inline-block" aria-label="DRFTN Clothing — Home">
            <div className="relative w-36 h-12">
              <Image
                src="/logo.png?v=3"
                alt="DRFTN Clothing"
                fill
                sizes="144px"
                className="object-contain object-left opacity-95 hover:opacity-100 transition-opacity"
              />
            </div>
          </Link>
          <p className="text-zinc-400 text-xs leading-relaxed font-body font-light max-w-xs">
            Born in Yelahanka, Bengaluru. Premium, imported streetwear and unisex fashion crafted for those who move with intention.
          </p>

          {/* Socials */}
          <div className="flex items-center gap-2.5" aria-label="Social media links">
            {[
              { label: 'Instagram', icon: InstagramIcon, href: 'https://instagram.com/drftnclothing' },
              { label: 'Facebook', icon: FacebookIcon, href: 'https://instagram.com/drftnclothing' },
              { label: 'Pinterest', icon: PinterestIcon, href: 'https://instagram.com/drftnclothing' },
              { label: 'YouTube', icon: YoutubeIcon, href: 'https://instagram.com/drftnclothing' }
            ].map((soc) => {
              const Icon = soc.icon;
              return (
                <a
                  key={soc.label}
                  href={soc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 flex items-center justify-center border border-zinc-800 hover:border-white text-zinc-400 hover:text-white transition-colors rounded"
                  aria-label={`Follow DRFTN on ${soc.label}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              );
            })}
          </div>

          {/* Newsletter Box */}
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-zinc-400 block">Join the Drop List</span>
              <form onSubmit={handleNewsletterSubmit} className="flex max-w-xs" aria-label="Newsletter signup">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 focus:border-white focus:outline-none font-mono rounded-l"
                />
                <button
                  type="submit"
                  className="bg-white hover:bg-zinc-200 text-black px-3 flex items-center justify-center transition-colors cursor-pointer rounded-r"
                  aria-label="Subscribe"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Browser Push alerts section */}
            <div className="pt-4 border-t border-zinc-900 space-y-2">
              <span className="text-[9px] uppercase tracking-[0.25em] font-bold text-zinc-400 block">Browser Alerts</span>
              {subscribed === 'unsupported' ? (
                <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-widest block">Alerts not supported</span>
              ) : subscribed ? (
                <div className="inline-flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider font-mono">
                  <CheckCircle className="w-4 h-4 shrink-0" /> You&apos;re Subscribed
                </div>
              ) : (
                <button
                  onClick={handleSubscribe}
                  className="w-full max-w-xs bg-zinc-950 border border-zinc-800 hover:border-white text-white py-2.5 px-4 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 cursor-pointer font-mono rounded"
                >
                  <Bell className="w-3.5 h-3.5" /> Enable Notifications
                </button>
              )}
            </div>
          </div>
        </div>

        {/* columns 2-5: Dynamic grid links with mobile accordion controls */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 lg:gap-12">
          
          {/* Shop Column */}
          <div className="space-y-4">
            <button 
              onClick={() => toggleAccordion('shop')}
              className="flex justify-between items-center w-full md:cursor-default text-left md:block border-b border-zinc-900 md:border-none pb-2 md:pb-0"
            >
              <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white font-body">Shop</h2>
              <span className="md:hidden text-white">
                {activeAccordion === 'shop' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>
            <ul className={`space-y-2.5 md:block ${activeAccordion === 'shop' ? 'block' : 'hidden'}`}>
              {shopLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-xs text-zinc-400 hover:text-white transition-colors tracking-wide font-body">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Care Column */}
          <div className="space-y-4">
            <button 
              onClick={() => toggleAccordion('customer')}
              className="flex justify-between items-center w-full md:cursor-default text-left md:block border-b border-zinc-900 md:border-none pb-2 md:pb-0"
            >
              <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white font-body">Customer Care</h2>
              <span className="md:hidden text-white">
                {activeAccordion === 'customer' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>
            <ul className={`space-y-2.5 md:block ${activeAccordion === 'customer' ? 'block' : 'hidden'}`}>
              {customerLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-xs text-zinc-400 hover:text-white transition-colors tracking-wide font-body">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div className="space-y-4">
            <button 
              onClick={() => toggleAccordion('company')}
              className="flex justify-between items-center w-full md:cursor-default text-left md:block border-b border-zinc-900 md:border-none pb-2 md:pb-0"
            >
              <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white font-body">Company</h2>
              <span className="md:hidden text-white">
                {activeAccordion === 'company' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>
            <ul className={`space-y-2.5 md:block ${activeAccordion === 'company' ? 'block' : 'hidden'}`}>
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-xs text-zinc-400 hover:text-white transition-colors tracking-wide font-body">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-4">
            <button 
              onClick={() => toggleAccordion('legal')}
              className="flex justify-between items-center w-full md:cursor-default text-left md:block border-b border-zinc-900 md:border-none pb-2 md:pb-0"
            >
              <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white font-body">Legal</h2>
              <span className="md:hidden text-white">
                {activeAccordion === 'legal' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
            </button>
            <ul className={`space-y-2.5 md:block ${activeAccordion === 'legal' ? 'block' : 'hidden'}`}>
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-xs text-zinc-400 hover:text-white transition-colors tracking-wide font-body">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="border-t border-zinc-900 bg-zinc-950/60 py-8 px-6 md:px-12">
        <div className="max-w-screen-2xl mx-auto flex flex-col gap-6">
          
          {/* Trust and Payment rows */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-zinc-900 pb-6">
            <TrustBadges />
            <PaymentIcons />
          </div>
          
          {/* Copyright, legal disclaimer & credits */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] text-zinc-400 font-mono tracking-wider">
            <p>
              © {new Date().getFullYear()} DRFTN CLOTHING. All rights reserved.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/policies/terms-and-conditions" className="hover:text-white transition-colors">TERMS</Link>
              <span>|</span>
              <Link href="/policies/privacy-policy" className="hover:text-white transition-colors">PRIVACY</Link>
              <span>|</span>
              <Link href="/sitemap.xml" className="hover:text-white transition-colors">SITEMAP</Link>
            </div>
            <p className="uppercase tracking-widest text-[9px] text-zinc-500">
              Made in Bengaluru
            </p>
          </div>
          
        </div>
      </div>
    </footer>
  );
}
