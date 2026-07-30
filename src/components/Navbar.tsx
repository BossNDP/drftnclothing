'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, X, Menu, Search, Heart } from 'lucide-react';
import { useCartStore } from '../lib/cartStore';
import { useWishlistStore } from '../lib/wishlistStore';
import { useAnimationStore } from '../lib/animationStore';
import { useAuthSession } from '@/context/AuthContext';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import AnnouncementTicker from './AnnouncementTicker';

const NAV_LINKS = [
  { href: '/shop', label: 'Collection' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSignedIn, isLoaded, user, logout, openAuthModal } = useAuthSession();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const setIsOpen = useCartStore((state) => state.setIsOpen);
  const isCartOpen = useCartStore((state) => state.isOpen);
  const cartCount = useCartStore((state) => state.items.reduce((acc, item) => acc + item.quantity, 0));
  const wishlistCount = useWishlistStore((state) => state.wishlistIds.size);
  const fetchWishlist = useWishlistStore((state) => state.fetchWishlist);
  const cartPulseActive = useAnimationStore((state) => state.cartPulseActive);
  const wishlistPulseActive = useAnimationStore((state) => state.wishlistPulseActive);

  useEffect(() => {
    if (isLoaded) {
      fetchWishlist(!!isSignedIn);
    }
  }, [isLoaded, isSignedIn, fetchWishlist]);

  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const isHomepage = pathname === '/';
  const isAdminPage = pathname?.startsWith('/admin');

  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

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

  // Directional scroll listener for Navbar Auto-Hide (Optimized: zero React re-renders on continuous scroll ticks)
  const navVisibleRef = useRef(true);
  useEffect(() => {
    const handleDirectionalScroll = () => {
      const currentY = window.scrollY;
      let nextVisible = navVisibleRef.current;

      if (currentY <= 80) {
        nextVisible = true;
      } else if (currentY > lastScrollY.current + 6) {
        nextVisible = false;
      } else if (currentY < lastScrollY.current - 6) {
        nextVisible = true;
      }

      if (nextVisible !== navVisibleRef.current) {
        navVisibleRef.current = nextVisible;
        setNavVisible(nextVisible);
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', handleDirectionalScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleDirectionalScroll);
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
      {/* ── Fixed Top Header Container ── */}
      <div className="fixed top-0 left-0 w-full z-[5000] pointer-events-auto">
        {/* ── Announcement Bar ── */}
        <AnnouncementTicker />

        {/* ── Main Navigation Top Rail (Desktop) ── */}
        <header
          suppressHydrationWarning
          className="w-full hidden md:block transition-all duration-300 bg-black/85 backdrop-blur-md border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
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
              className="hidden sm:flex text-brand-silver hover:text-white p-2.5 transition-colors"
              aria-label="Open search overlay"
            >
              <Search className="w-4.5 h-4.5 stroke-[1.8]" />
            </button>

            {/* Wishlist Trigger with Heart Burst Animation & Phone Haptic Vibration */}
            <motion.div
              whileTap={{ scale: 0.85 }}
              animate={
                wishlistPulseActive
                  ? { scale: [1, 1.3, 0.9, 1.15, 1], rotate: [0, -12, 12, 0] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Link
                href="/wishlist"
                onClick={() => {
                  if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && window.navigator.vibrate) {
                    try {
                      window.navigator.vibrate([25, 40, 25]);
                    } catch (e) {
                      // ignore vibration errors if not supported
                    }
                  }
                }}
                className="relative flex items-center justify-center p-2 text-zinc-400 hover:text-white transition-colors group"
                aria-label={`Wishlist${mounted && wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}
              >
                <Heart
                  className={`w-5 h-5 stroke-[1.8] transition-all duration-300 ${mounted && wishlistCount > 0
                    ? 'text-pink-500 fill-pink-500 filter drop-shadow-[0_0_5px_rgba(236,72,153,0.6)]'
                    : 'text-zinc-400 group-hover:text-pink-400'
                    }`}
                />
                {mounted && wishlistCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 bg-pink-500 text-white text-[9px] font-bold font-mono h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-black shadow-sm"
                    aria-hidden="true"
                  >
                    {wishlistCount}
                  </motion.span>
                )}
              </Link>
            </motion.div>

            {/* Cart Trigger */}
            <button
              onClick={() => setIsOpen(true)}
              className={`relative flex items-center justify-center p-2 transition-all duration-200 group ${cartPulseActive ? 'scale-125 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              aria-label={`Open cart${mounted && cartCount > 0 ? `, ${cartCount} items` : ''}`}
            >
              <ShoppingBag className="w-5 h-5 stroke-[1.8] text-zinc-400 group-hover:text-white transition-colors" />
              {mounted && cartCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 bg-white text-black text-[9px] font-bold font-mono h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center border border-black shadow-sm animate-scale-in"
                  aria-hidden="true"
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Auth Account Menu (Mobile & Desktop) */}
            <div ref={accountMenuRef} className="flex items-center pl-1 sm:pl-2" suppressHydrationWarning>
              {!mounted || !isLoaded ? (
                <div className="w-8 h-6 flex items-center justify-end" aria-hidden="true" />
              ) : !isSignedIn ? (
                <button
                  onClick={() => openAuthModal()}
                  className="text-[9px] font-bold tracking-[0.2em] uppercase text-brand-silver hover:text-white transition-colors duration-200 cursor-pointer px-1 py-1"
                  aria-label="Sign in to your account"
                >
                  Sign In
                </button>
              ) : (
                <div className="relative group z-50">
                  <button
                    onClick={() => setAccountMenuOpen((prev) => !prev)}
                    className="w-7 h-7 rounded-full bg-brand-graphite border border-white/20 text-white flex items-center justify-center text-[10px] font-mono font-bold hover:border-white transition-colors cursor-pointer"
                    aria-label="Open Account Menu"
                  >
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </button>
                  <div
                    className={`absolute right-0 top-full pt-2 w-44 z-50 transition-all duration-200 ${accountMenuOpen
                      ? 'opacity-100 pointer-events-auto'
                      : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                      }`}
                  >
                    <div className="bg-zinc-950 border border-white/15 rounded-md shadow-2xl py-1 overflow-hidden backdrop-blur-xl">
                      <Link
                        href="/account/orders"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase text-zinc-300 hover:text-white hover:bg-white/10"
                      >
                        Orders
                      </Link>
                      <Link
                        href="/wishlist"
                        onClick={() => setAccountMenuOpen(false)}
                        className="flex items-center justify-between px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase text-zinc-300 hover:text-white hover:bg-white/10 border-t border-white/10"
                      >
                        <span>Wishlist</span>
                        {mounted && wishlistCount > 0 && (
                          <span className="bg-pink-500/20 text-pink-300 border border-pink-500/40 text-[8px] px-1.5 py-0.2 rounded-full font-mono">
                            {wishlistCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/account/orders"
                        onClick={() => setAccountMenuOpen(false)}
                        className="block px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase text-zinc-300 hover:text-white hover:bg-white/10 border-t border-white/10"
                      >
                        Profile
                      </Link>
                      <button
                        onClick={() => {
                          setAccountMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left block px-4 py-2.5 text-[9px] font-bold tracking-wider uppercase text-brand-red hover:bg-white/10 cursor-pointer border-t border-white/10"
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
          {mounted && (
            <motion.div
              className="absolute bottom-0 left-0 h-[2px] bg-white origin-left w-full"
              style={{ scaleX }}
              aria-hidden="true"
            />
          )}
        </nav>
      </header>

      {/* ── Mobile Navigation Top Rail ── */}
      <header
        suppressHydrationWarning
        className={`w-full md:hidden ${mounted && isCartOpen ? 'hidden' : ''
          } bg-black/85 backdrop-blur-lg border-b border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-300`}
      >
        <div className="h-12 md:h-16 flex items-center justify-between px-5 sm:px-6 relative">
          {/* Left: Wordmark Logo */}
          <Link
            href="/"
            className="flex items-center select-none group flex-shrink-0"
            aria-label="DRFTN Clothing — Home"
          >
            <div className="relative w-[90px] h-5 sm:w-[94px] sm:h-6">
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

          {/* Right: Wishlist Heart icon + Cart icon + Auth control */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Wishlist Heart Icon with Badge */}
            <motion.div
              whileTap={{ scale: 0.85 }}
              animate={
                wishlistPulseActive
                  ? { scale: [1, 1.3, 0.9, 1.15, 1], rotate: [0, -12, 12, 0] }
                  : { scale: 1 }
              }
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Link
                href="/wishlist"
                onClick={() => {
                  if (typeof window !== 'undefined' && typeof window.navigator !== 'undefined' && window.navigator.vibrate) {
                    try {
                      window.navigator.vibrate([25, 40, 25]);
                    } catch (e) {
                      // ignore vibration errors
                    }
                  }
                }}
                className="relative flex items-center justify-center p-1.5 text-zinc-400 hover:text-white transition-colors group"
                aria-label={`Wishlist${mounted && wishlistCount > 0 ? `, ${wishlistCount} items` : ''}`}
              >
                <Heart
                  className={`w-5 h-5 stroke-[1.8] transition-all duration-300 ${mounted && wishlistCount > 0
                    ? 'text-pink-500 fill-pink-500 filter drop-shadow-[0_0_5px_rgba(236,72,153,0.6)]'
                    : 'text-zinc-400 group-hover:text-pink-400'
                    }`}
                />
                {mounted && wishlistCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-0 right-0 bg-pink-500 text-white text-[8px] font-bold font-mono h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center border border-black shadow-sm"
                    aria-hidden="true"
                  >
                    {wishlistCount}
                  </motion.span>
                )}
              </Link>
            </motion.div>

            {/* Cart Icon with Badge */}
            <button
              onClick={() => setIsOpen(true)}
              className={`relative flex items-center justify-center p-1.5 transition-all duration-200 ${cartPulseActive ? 'scale-125 text-white' : 'text-zinc-400 hover:text-white'}`}
              aria-label={`Open cart${mounted && cartCount > 0 ? `, ${cartCount} items` : ''}`}
            >
              <ShoppingBag className="w-5 h-5 stroke-[1.8]" />
              {mounted && cartCount > 0 && (
                <span
                  className="absolute top-0.5 right-0.5 bg-white text-black text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  {cartCount}
                </span>
              )}
            </button>

            {/* Auth Control */}
            <div className="relative min-w-[32px] min-h-[32px] flex items-center justify-end" suppressHydrationWarning>
              {!mounted || !isLoaded ? (
                <div className="w-8 h-8 rounded-full bg-transparent" aria-hidden="true" />
              ) : !isSignedIn ? (
                <button
                  onClick={() => openAuthModal()}
                  className="px-3.5 py-1.5 rounded-full border border-white/20 bg-transparent text-[11px] font-mono tracking-widest text-white uppercase transition-colors hover:border-white/50 active:bg-white/10 cursor-pointer"
                  aria-label="Sign In"
                >
                  SIGN IN
                </button>
              ) : (
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
                {mounted && mobileDropdownOpen && (
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
                      className="absolute right-0 top-full mt-3 w-48 z-50 rounded-2xl border border-white/10 bg-[#0A0A0A]/85 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden"
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
                          href="/wishlist"
                          onClick={() => setMobileDropdownOpen(false)}
                          className="px-5 py-3 text-xs uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 flex items-center justify-between"
                        >
                          <span>Wishlist</span>
                          {mounted && wishlistCount > 0 && (
                            <span className="bg-pink-500/20 text-pink-300 border border-pink-500/40 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold">
                              {wishlistCount}
                            </span>
                          )}
                        </Link>
                        <Link
                          href="/account/orders"
                          onClick={() => setMobileDropdownOpen(false)}
                          className="px-5 py-3 text-xs uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5"
                        >
                          Profile
                        </Link>
                        <button
                          onClick={() => {
                            logout();
                            setMobileDropdownOpen(false);
                          }}
                          className="w-full text-left px-5 py-3 text-xs uppercase tracking-wider text-brand-red hover:bg-white/5 transition-colors cursor-pointer"
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
      </div>

      {/* Mobile Drawer Navigation Menu Overlay */}
      <AnimatePresence>
        {mounted && mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2500]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-brand-black border-r border-brand-graphite z-[2600] p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-8 border-b border-brand-graphite">
                  <div className="relative w-28 h-7">
                    <Image
                      src="/logo.png?v=3"
                      alt="DRFTN"
                      fill
                      sizes="112px"
                      className="object-contain object-left"
                    />
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 text-brand-silver hover:text-white"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <nav className="flex flex-col gap-6 pt-8">
                  {NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`text-lg font-bold tracking-[0.2em] uppercase ${pathname === link.href ? 'text-brand-red' : 'text-brand-offwhite'
                        }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="pt-8 border-t border-brand-graphite flex flex-col gap-4">
                {!isLoaded ? null : !isSignedIn ? (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal();
                    }}
                    className="w-full py-3 bg-white text-black font-bold text-xs uppercase tracking-widest"
                  >
                    Sign In
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full py-3 border border-brand-red text-brand-red font-bold text-xs uppercase tracking-widest"
                  >
                    Logout
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Modal Overlay */}
      <AnimatePresence>
        {mounted && searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-md flex items-start justify-center pt-24 px-4"
          >
            <div className="w-full max-w-2xl relative">
              <button
                onClick={() => setSearchOpen(false)}
                className="absolute -top-12 right-0 text-brand-silver hover:text-white p-2"
              >
                <X className="w-6 h-6" />
              </button>
              <form onSubmit={handleSearchSubmit}>
                <input
                  type="text"
                  placeholder="Search collection, hoodies, tees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-brand-black border-b-2 border-white px-4 py-4 text-xl md:text-2xl font-mono text-white placeholder-zinc-500 focus:outline-none"
                />
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
