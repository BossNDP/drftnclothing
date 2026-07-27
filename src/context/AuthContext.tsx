'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/components/ToastContainer';
import { useSignIn, useClerk, useAuth as useClerkAuth } from '@clerk/nextjs';
import { X, Loader2, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  phone: string | null;
  phoneVerified: boolean;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  notificationsOptIn: boolean;
  termsAcceptedAt: string | null;
  authProvider: 'phone' | 'google';
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  openAuthModal: (mode?: 'phone' | 'google') => void;
  closeAuthModal: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Web Push Subscription Helper
export async function subscribeToWebPush(addToast: (msg: string, type: 'success' | 'error') => void) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const rawKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!rawKey) {
      throw new Error('VAPID public key not configured');
    }
    const { urlBase64ToUint8Array } = await import('@/lib/vapid');
    const applicationServerKey = urlBase64ToUint8Array(rawKey);

    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.toJSON().keys?.p256dh, auth: subscription.toJSON().keys?.auth },
        productId: null,
      }),
    });
    if (!res.ok) throw new Error('Subscription save failed');

    localStorage.setItem('push_alerts_subscribed', 'true');
    window.dispatchEvent(new Event('push-subscription-changed'));

    addToast('Successfully subscribed to notifications!', 'success');
  } catch (err) {
    console.error('Auto push subscription failed:', err);
  }
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast();
  const { signOut } = useClerk();
  const { signIn, isLoaded: clerkSignInLoaded } = useSignIn();
  const { isSignedIn: clerkIsSignedIn, isLoaded: clerkAuthLoaded } = useClerkAuth();

  // ── Core session state ──────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);

  // ── Modal state ─────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'phone' | 'google'>('phone');

  // ── Verification / profile-completion state ──────────────────────
  const [isVerifying, setIsVerifying] = useState(false);
  const [profileStep, setProfileStep] = useState(false); // true = new user, show name form
  const [tempToken, setTempToken] = useState<string | null>(null);

  // ── Profile form state (new-user step) ───────────────────────────
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [notificationsOptIn, setNotificationsOptIn] = useState(true);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);

  // ── Fetch session on mount ───────────────────────────────────────
  const refreshUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error('Failed to fetch auth session:', err);
    } finally {
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    setMounted(true);
    refreshUser().then(() => {
      // In-tab flow: phone-callback page stashes tempToken here for new users
      const pendingToken = sessionStorage.getItem('pending_new_user_temp_token');
      if (pendingToken) {
        sessionStorage.removeItem('pending_new_user_temp_token');
        setTempToken(pendingToken);
        setProfileStep(true);
        setModalOpen(true);
        setModalMode('phone');
      }
    });
  }, []);

  // ── Detect Clerk Google session and sync with custom auth ────────
  useEffect(() => {
    if (clerkAuthLoaded && clerkIsSignedIn && !user && isLoaded) {
      // Clerk has a session (e.g. after Google OAuth redirect) but our
      // custom auth hasn't picked it up yet. Trigger a sync.
      refreshUser();
    }
  }, [clerkAuthLoaded, clerkIsSignedIn, user, isLoaded]);

  // ── Heartbeat (active users) ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
    const interval = setInterval(() => {
      fetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // ── Lock scroll when modal open ──────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = modalOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalOpen]);

  // ── Modal controls ───────────────────────────────────────────────
  const openAuthModal = (mode: 'phone' | 'google' = 'phone') => {
    setModalMode(mode);
    setIsVerifying(false);
    setProfileStep(false);
    setTempToken(null);
    setProfileFirstName('');
    setProfileLastName('');
    setProfileEmail('');
    setTermsAccepted(false);
    setNotificationsOptIn(true);
    setIsActionInProgress(false);
    setModalOpen(true);
  };

  const closeAuthModal = () => setModalOpen(false);

  // ── Logout ───────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      await signOut();
      setUser(null);
      addToast('Logged out successfully', 'success');
      window.location.reload();
    } catch (err) {
      console.error('Logout failed:', err);
      addToast('Failed to logout cleanly', 'error');
    }
  };

  // ── Google Login ─────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    if (isActionInProgress) return;

    // If Clerk already has a session (e.g. user already signed in via Google
    // but custom auth didn't sync), just sync and close the modal.
    if (clerkAuthLoaded && clerkIsSignedIn) {
      setIsActionInProgress(true);
      try {
        await refreshUser();
        closeAuthModal();
        addToast('Welcome back! 👋', 'success');
      } catch (err) {
        console.error('Session sync failed:', err);
        addToast('Failed to sync your session. Please try again.', 'error');
      } finally {
        setIsActionInProgress(false);
      }
      return;
    }

    if (!clerkSignInLoaded || !signIn) {
      addToast('Authentication service is loading, please try again.', 'error');
      return;
    }
    setIsActionInProgress(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: window.location.origin,
      });
    } catch (err: any) {
      // Handle "session_exists" — Clerk already has a session, just sync
      const code = err?.errors?.[0]?.code || err?.code;
      if (code === 'session_exists') {
        try {
          await refreshUser();
          closeAuthModal();
          addToast('Welcome back! 👋', 'success');
        } catch (syncErr) {
          console.error('Session sync after session_exists failed:', syncErr);
        }
      } else {
        console.error('Google OAuth direct trigger failed:', err);
        addToast('Failed to start Google Sign-In', 'error');
      }
      setIsActionInProgress(false);
    }
  };

  // ── Phone OTP — open phone.email popup ───────────────────────────
  const startPhoneOTP = () => {
    if (isActionInProgress) return;
    setIsActionInProgress(true);
    const finalClientId = process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID || '17565400827940866842';
    // Use the canonical app URL (without www) to match the phone.email whitelist.
    // Falls back to window.location.origin for local development.
    const appBase = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const redirectUrl = `${appBase}/phone-callback`;
    const authUrl =
      `https://auth.phone.email/log-in` +
      `?client_id=${finalClientId}` +
      `&redirect_url=${encodeURIComponent(redirectUrl)}`;

    const w = 500, h = 600;
    const left = window.screen.width / 2 - w / 2;
    const top = window.screen.height / 2 - h / 2;
    window.open(authUrl, 'phone_email_popup', `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);

    // Auto unlock after 3 seconds in case window was blocked
    setTimeout(() => {
      setIsActionInProgress(false);
    }, 3000);
  };

  // ── Listen for postMessage from phone-callback popup ─────────────
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'PHONE_EMAIL_VERIFIED') return;

      const token = event.data.accessToken as string;

      // Make sure the modal is visible for loading + profile step feedback
      setModalOpen(true);
      setModalMode('phone');
      setProfileStep(false);
      setIsVerifying(true);

      try {
        const res = await fetch('/api/auth/verify-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          if (data.isNewUser) {
            // New user → show profile completion form
            setTempToken(data.tempToken);
            setProfileStep(true);
          } else {
            // Returning user → log in immediately, no extra steps
            setUser(data.user);
            addToast('Welcome back! 👋', 'success');
            if (data.user?.notificationsOptIn) subscribeToWebPush(addToast);
            closeAuthModal();
          }
        } else {
          addToast(data.error || 'Phone verification failed. Please try again.', 'error');
        }
      } catch (err) {
        console.error('Verification error:', err);
        addToast('Something went wrong during verification.', 'error');
      } finally {
        setIsVerifying(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addToast]);

  // ── Profile form submit (new user only) ──────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = `${profileFirstName.trim()} ${profileLastName.trim()}`.trim();
    if (fullName.length < 2) {
      addToast('Please enter your first name', 'error');
      return;
    }
    if (!termsAccepted) {
      addToast('Please accept the Terms & Conditions to continue', 'error');
      return;
    }

    setIsSubmittingProfile(true);
    try {
      const res = await fetch('/api/auth/register-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fullName,
          email: profileEmail.trim() || undefined,
          tempToken,
          notificationsOptIn,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUser(data.user);
        addToast('Welcome to DRFTN! 🎉', 'success');
        if (data.triggerPush) subscribeToWebPush(addToast);
        closeAuthModal();
      } else {
        addToast(data.error || 'Failed to save profile. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Profile submit error:', err);
      addToast('Something went wrong. Please try again.', 'error');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // ── Escape key dismiss ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen && !isVerifying && !profileStep) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, isVerifying, profileStep]);

  return (
    <AuthContext.Provider value={{ user, isSignedIn: !!user, isLoaded, openAuthModal, closeAuthModal, logout, refreshUser }}>
      {children}

      {/* ── Auth Modal Portal ── */}
      {mounted && createPortal(
        <AnimatePresence>
          {modalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => { if (!isVerifying && !profileStep) closeAuthModal(); }}
              style={{ zIndex: 99999 }}
              className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[420px] bg-zinc-950 border border-white/10 p-6 md:p-8 flex flex-col items-center gap-6 shadow-[0_0_80px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto"
              >
                {/* Close button — hidden while verifying */}
                {!isVerifying && (
                  <button
                    onClick={closeAuthModal}
                    className="absolute top-2 right-2 text-zinc-500 hover:text-white transition-colors w-12 h-12 flex items-center justify-center cursor-pointer z-50"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}

                {/* Logo */}
                <div className="relative w-64 md:w-72 h-14 md:h-16 select-none flex items-center justify-center">
                  <img
                    src="/logo.png?v=3"
                    alt="DRFTN"
                    className="object-contain w-full h-full grayscale brightness-[100]"
                  />
                </div>

                {/* ── VERIFYING STATE ── */}
                {isVerifying && (
                  <div className="flex flex-col items-center gap-4 py-6 w-full">
                    <Loader2 className="w-10 h-10 text-zinc-400 animate-spin" />
                    <p className="text-xs uppercase tracking-widest text-zinc-400 font-mono">
                      Verifying your phone…
                    </p>
                  </div>
                )}

                {/* ── PROFILE COMPLETION STEP (new user) ── */}
                {!isVerifying && profileStep && (
                  <form onSubmit={handleProfileSubmit} className="w-full space-y-4 font-body">
                    <div className="text-center space-y-1 pb-2">
                      <h3 className="text-sm font-black uppercase text-white tracking-widest font-mono">
                        Complete Your Profile
                      </h3>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider leading-relaxed">
                        One last step to finish setting up your account
                      </p>
                    </div>

                    <style dangerouslySetInnerHTML={{
                      __html: `.auth-input { background-color: #ffffff !important; color: #000000 !important; border: 1px solid #ffffff !important; }
                      .auth-input::placeholder { color: #71717a !important; }`
                    }} />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                          First Name *
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="First"
                          value={profileFirstName}
                          onChange={(e) => setProfileFirstName(e.target.value)}
                          className="w-full auth-input px-3 py-3 text-xs focus:outline-none uppercase tracking-widest font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                          Last Name
                        </label>
                        <input
                          type="text"
                          placeholder="Last"
                          value={profileLastName}
                          onChange={(e) => setProfileLastName(e.target.value)}
                          className="w-full auth-input px-3 py-3 text-xs focus:outline-none uppercase tracking-widest font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. you@gmail.com"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        className="w-full auth-input px-3 py-3 text-xs focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-3 pt-1">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-0.5 accent-white shrink-0"
                        />
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider leading-relaxed">
                          I accept the{' '}
                          <a href="/policies/terms-and-conditions" target="_blank" className="text-white underline">
                            Terms &amp; Conditions
                          </a>{' '}
                          and{' '}
                          <a href="/policies/privacy-policy" target="_blank" className="text-white underline">
                            Privacy Policy
                          </a>{' '}
                          *
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={notificationsOptIn}
                          onChange={(e) => setNotificationsOptIn(e.target.checked)}
                          className="mt-0.5 accent-white shrink-0"
                        />
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider leading-relaxed">
                          Notify me about drops, restocks &amp; order updates
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingProfile}
                      className="w-full bg-white hover:bg-zinc-200 text-black py-3.5 font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                    >
                      {isSubmittingProfile ? 'Saving…' : 'Complete Setup →'}
                    </button>
                  </form>
                )}

                {/* ── UNIFIED SINGLE SIGN-IN SELECTION STEP ── */}
                {!isVerifying && !profileStep && (
                  <div className="w-full space-y-5">
                    <div className="text-center space-y-1">
                      <h3 className="text-sm font-black uppercase text-white tracking-widest font-mono">
                        Sign In
                      </h3>
                      <p className="text-[10px] text-zinc-400 uppercase tracking-wider leading-relaxed">
                        Join the drop list &amp; secure your checkout.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <button
                        onClick={startPhoneOTP}
                        disabled={isActionInProgress || isVerifying}
                        className="w-full bg-white hover:bg-zinc-200 text-black py-4 font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 cursor-pointer border border-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Smartphone className="w-4 h-4" />
                        {isActionInProgress ? 'Opening Secure Portal...' : 'Continue with Phone'}
                      </button>

                      <div className="relative text-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-white/10" />
                        </div>
                        <span className="relative bg-zinc-950 px-3 text-[9px] uppercase tracking-widest font-mono text-zinc-550">
                          Or
                        </span>
                      </div>

                      <button
                        onClick={handleGoogleLogin}
                        disabled={isActionInProgress || isVerifying}
                        className="w-full bg-transparent hover:bg-white/5 text-white border border-white/10 py-3.5 font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isActionInProgress ? 'Redirecting to Google...' : 'Google Account'}
                      </button>

                      <p className="text-center text-[9px] text-zinc-650 uppercase tracking-widest font-mono leading-relaxed">
                        By continuing you agree to our{' '}
                        <a href="/policies/terms-and-conditions" target="_blank" className="text-zinc-500 underline">
                          Terms
                        </a>{' '}
                        &amp;{' '}
                        <a href="/policies/privacy-policy" target="_blank" className="text-zinc-500 underline">
                          Privacy Policy
                        </a>
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </AuthContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthSession must be used within an AuthSessionProvider');
  }
  return context;
}
