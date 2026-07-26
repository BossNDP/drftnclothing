'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, X, Menu, Search } from 'lucide-react';
import { useCartStore } from '../lib/cartStore';
import { useAnimationStore } from '../lib/animationStore';
import { useAuthSession } from '@/context/AuthContext';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import AnnouncementTicker from './AnnouncementTicker';

const NAV_LINKS = [
  { href: '/shop', label: 'Collection' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn, isLoaded, user, logout, openAuthModal } = useAuthSession();
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const setIsOpen = useCartStore((state) => state.setIsOpen);
  const isCartOpen = useCartStore((state) => state.isOpen);
  const cartCount = useCartStore((state) => state.items.reduce((acc, item) => acc + item.quantity, 0));
  const cartPulseActive = useAnimationStore((state) => state.cartPulseActive);

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const isHomepage = pathname === '/';
  const isAdminPage = pathname?.startsWith('/admin');
  const isCheckoutPage = pathname === '/checkout';

  useEffect(() => {
    setMounted(true);
    const sentinel = document.getElementById('nav-scroll-sentinel');
    if (sentinel && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        ([entry]) => {
          setIsScrolled(!entry.isIntersecting);
        },
        { threshold: 0 }
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    } else {
      const handleScroll = () => {
        setIsScrolled(window.scrollY > 50);
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Lock scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  if (isAdminPage) return null;

  return (
    <>
      <div id="nav-scroll-sentinel" className="absolute top-0 left-0 w-full h-[50px] pointer-events-none z-[-1]" aria-hidden="true" />
      {/* ── Announcement Bar ── */}
      <AnnouncementTicker />

      {/* ── Main Navigation Top Rail ── */}
      <header
        className={`w-full sticky top-0 z-[2000] transition-all duration-300 hidden md:block ${isScrolled || !isHomepage
          ? 'bg-[#0A0A0A] border-b border-brand-graphite/40 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
          : 'bg-transparent border-b border-transparent'
          }`}
        role="banner"
      >
        {/* Subtle top scrim for nav and logo contrast */}
        <div
          className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/85 to-transparent pointer-events-none z-[-1]"
          aria-hidden="true"
        />

        <nav
          className="max-w-screen-2xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between relative"
          aria-label="Main navigation"
        >
          {/* Logo (Left-aligned) */}
          <Link
            href="/"
            className="flex items-center select-none group flex-shrink-0"
            aria-label="DRFTN Clothing — Home"
          >
            <div className="relative w-40 h-14 md:w-52 md:h-18">
              <Image
                src="/logo.png?v=3"
                alt="DRFTN Clothing"
                fill
                priority
                sizes="(max-width: 768px) 160px, 208px"
                className="object-contain object-left transition-opacity duration-300 group-hover:opacity-80 scale-[1.25] origin-left"
              />
            </div>
          </Link>

          {/* Desktop Navigation Links (Right-aligned / Spaced) */}
          <div className="hidden lg:flex items-center gap-8 ml-auto mr-12" role="list">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="listitem"
                className={`text-[10px] font-bold tracking-[0.2em] uppercase transition-colors duration-200 hover:text-white ${pathname === link.href || pathname?.startsWith(link.href + '?')
                  ? 'text-brand-red'
                  : 'text-brand-silver'
                  }`}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Action Icons (Search, Cart, User, Hamburger Menu) */}
          <div className="flex items-center gap-3 md:gap-4">

            {/* Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="text-brand-silver hover:text-white p-2.5 transition-colors"
              aria-label="Open search overlay"
            >
              <Search className="w-4.5 h-4.5 stroke-[1.8]" />
            </button>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsOpen(true)}
              className={`relative flex items-center p-2.5 transition-all duration-200 ${cartPulseActive ? 'scale-125 text-white' : 'text-brand-silver hover:text-white'
                }`}
              aria-label={`Open cart${mounted && cartCount > 0 ? `, ${cartCount} items` : ''}`}
            >
              <ShoppingBag className="w-4.5 h-4.5 stroke-[1.8]" />
              {mounted && cartCount > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 bg-white text-black text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center animate-scale-in"
                  aria-hidden="true"
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Desktop Auth */}
            <div className="hidden lg:flex items-center pl-2">
              {mounted && isLoaded && !isSignedIn && (
                <button
                  onClick={() => openAuthModal()}
                  className="text-[9px] font-bold tracking-[0.2em] uppercase text-brand-silver hover:text-white transition-colors duration-200 cursor-pointer"
                  aria-label="Sign in to your account"
                >
                  Sign In
                </button>
              )}
              {mounted && isLoaded && isSignedIn && (
                <div className="relative group z-50">
                  <button
                    className="w-6 h-6 rounded-full bg-brand-graphite border border-white/20 text-white flex items-center justify-center text-[10px] font-mono font-bold hover:border-white transition-colors cursor-pointer"
                    aria-label="Open Account Menu"
                  >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </button>
                  <div className="absolute right-0 top-full pt-2 w-40 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200">
                    <div className="bg-zinc-950 border border-white/10 rounded-none shadow-2xl py-1">
                      <Link href="/account/orders" className="block px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase text-zinc-400 hover:text-white hover:bg-white/5">
                        Orders
                      </Link>
                      <Link href="/account/orders" className="block px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase text-zinc-400 hover:text-white hover:bg-white/5 border-t border-white/5">
                        Profile
                      </Link>
                      <button
                        onClick={logout}
                        className="w-full text-left block px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase text-brand-red hover:bg-white/5 cursor-pointer border-t border-white/5"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile/Tablet Menu Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-brand-silver hover:text-white p-2.5 transition-colors"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="w-5 h-5 stroke-[1.8]" />
            </button>

          </div>

          {/* Scroll Progress Bar / Speedometer Underline indicator */}
          <motion.div
            className="absolute bottom-0 left-0 h-[2px] bg-white origin-left w-full"
            style={{ scaleX }}
            aria-hidden="true"
          />
        </nav>
      </header>

      {/* ── Mobile Navigation Top Rail — hidden when cart is open to prevent collision ── */}
      {!isCartOpen && (
        <header
          className={`w-full sticky top-0 z-[2000] transition-all duration-300 md:hidden ${isScrolled
            ? 'bg-black/40 backdrop-blur-md border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
            : 'bg-transparent border-b border-transparent'
            }`}
        >
          <div className="h-16 flex items-center justify-between px-6 relative">
            {/* Left: Wordmark Logo */}
            <Link
              href="/"
              className="flex items-center select-none group flex-shrink-0"
              aria-label="DRFTN Clothing — Home"
            >
              <div className="relative w-[94px] h-6">
                <Image
                  src="/logo-cropped.png"
                  alt="DRFTN Clothing"
                  fill
                  priority
                  sizes="120px"
                  className="object-contain object-left transition-opacity duration-300 group-hover:opacity-80"
                />
              </div>
            </Link>

            {/* Right: Cart icon + Auth control */}
            <div className="flex items-center gap-3">
              {/* Cart Icon with Badge */}
              <button
                onClick={() => setIsOpen(true)}
                className={`relative flex items-center justify-center p-2 transition-all duration-200 ${cartPulseActive ? 'scale-125 text-white' : 'text-zinc-400 hover:text-white'}`}
                aria-label={`Open cart${mounted && cartCount > 0 ? `, ${cartCount} items` : ''}`}
              >
                <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
                {mounted && cartCount > 0 && (
                  <span
                    className="absolute top-1 right-1 bg-white text-black text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center"
                    aria-hidden="true"
                  >
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Auth Control */}
              <div className="relative">
                {mounted && isLoaded && !isSignedIn && (
                  <button
                    onClick={() => openAuthModal()}
                    className="px-3.5 py-1.5 rounded-full border border-white/20 bg-transparent text-[11px] font-mono tracking-widest text-white uppercase transition-colors hover:border-white/50 active:bg-white/10 cursor-pointer"
                    aria-label="Sign In"
                  >
                    SIGN IN
                  </button>
                )}

                {mounted && isLoaded && isSignedIn && (
                  <button
                    onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
                    className="relative flex items-center justify-center rounded-full p-0.5 cursor-pointer"
                    aria-label="Open Account Dropdown"
                  >
                    <span className="w-8 h-8 rounded-full bg-brand-graphite border border-white/20 text-white flex items-center justify-center text-xs font-mono font-bold">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </button>
                )}

                {/* Account Dropdown */}
                <AnimatePresence>
                  {mobileDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-transparent"
                        onClick={() => setMobileDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10, x: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="absolute right-0 mt-3 w-48 z-50 rounded-2xl border border-white/10 bg-[#0A0A0A]/85 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden"
                      >
                        <div className="py-2 flex flex-col font-body">
                          <Link
                            href="/account/orders"
                            onClick={() => setMobileDropdownOpen(false)}
                            className="px-5 py-3 text-xs uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5"
                          >
                            Orders
                          </Link>
                          <Link
                            href="/account/orders"
                            onClick={() => setMobileDropdownOpen(false)}
                            className="px-5 py-3 text-xs uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5"
                          >
                            Profile
                          </Link>
                          <button
                            onClick={async () => {
                              setMobileDropdownOpen(false);
                              await logout();
                            }}
                            className="px-5 py-3 text-left text-xs uppercase tracking-wider text-white hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            Logout
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* ── Search Overlay Modal ── */}
      {searchOpen && (
        <div className="fixed inset-0 z-[3000] bg-[#0A0A0A] backdrop-blur-xl flex flex-col justify-start px-6 pt-24 animate-[fadeIn_0.3s_ease-out_forwards]">
          {/* Close Button */}
          <button
            onClick={() => setSearchOpen(false)}
            className="absolute top-6 right-6 p-2 text-brand-stone hover:text-white transition-colors"
            aria-label="Close search overlay"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="w-full max-w-lg mx-auto">
            <label className="text-[10px] uppercase tracking-[0.2em] text-brand-stone font-bold block mb-2 font-body">
              Search Collection
            </label>
            <div className="relative border-b border-brand-graphite py-2 flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="TYPE TO SEARCH..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-lg font-display text-white uppercase tracking-widest focus:outline-none placeholder-brand-graphite"
              />
              <button type="submit" className="text-brand-stone hover:text-white p-1">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Mobile Full-Screen Menu Drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[3000] bg-[#0A0A0A] flex flex-col justify-between px-8 py-8 animate-[fadeIn_0.25s_ease-out_forwards]">
          {/* Top Bar inside Drawer */}
          <div className="flex items-center justify-between">
            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="relative w-28 h-10 block">
              <Image src="/logo.png?v=3" alt="DRFTN Logo" fill className="object-contain object-left" />
            </Link>
            <button onClick={() => setMobileMenuOpen(false)} className="text-white p-2" aria-label="Close navigation menu">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Drawer Nav Links */}
          <nav className="flex flex-col space-y-6 pt-16 flex-grow" aria-label="Mobile navigation links">
            {NAV_LINKS.map((link, idx) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-4xl font-display font-black uppercase tracking-wider text-brand-silver hover:text-white transition-colors"
              >
                <span className="text-brand-red text-lg font-mono mr-3">{String(idx + 1).padStart(2, '0')}</span>
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Bottom section of Drawer */}
          <div className="border-t border-brand-graphite/40 pt-6 flex items-center justify-between">
            <div>
              {mounted && isLoaded && !isSignedIn && (
                <button
                  onClick={() => { setMobileMenuOpen(false); openAuthModal(); }}
                  className="text-xs font-bold uppercase tracking-widest text-brand-silver hover:text-white cursor-pointer"
                >
                  Sign In / Register
                </button>
              )}
              {mounted && isLoaded && isSignedIn && (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-graphite border border-white/20 text-white flex items-center justify-center text-[10px] font-mono font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs uppercase tracking-wider text-brand-stone font-bold font-mono">{user?.name}</span>
                </div>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-widest text-brand-stone">BENGALURU STREETWEAR</p>
          </div>
        </div>
      )}
    </>
  );
}
