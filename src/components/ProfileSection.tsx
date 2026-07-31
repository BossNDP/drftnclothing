'use client';

import React, { useState } from 'react';
import { useToast } from '@/components/ToastContainer';
import { useAuthSession } from '@/context/AuthContext';
import { User, Lock, Edit2, Check, Phone, ShieldCheck } from 'lucide-react';

interface ProfileSectionProps {
  initialName: string;
  phone: string;
  authProvider: string;
}

export default function ProfileSection({ initialName, phone, authProvider }: ProfileSectionProps) {
  const { addToast } = useToast();
  const { refreshUser } = useAuthSession();

  const [name, setName] = useState(initialName);
  const [phoneInput, setPhoneInput] = useState(() => {
    // Normalise existing phone — strip +91 prefix if present
    if (!phone) return '';
    const s = phone.trim();
    if (s.startsWith('+91') && s.length === 13) return s.slice(3);
    if (s.startsWith('91') && s.length === 12) return s.slice(2);
    return s;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(!!phone && phone.trim().length > 0); // Already verified if exists

  // Gmail users can update phone; phone users cannot
  const normalizedProvider = (authProvider || '').toLowerCase();
  const isGmailUser = normalizedProvider === 'google';
  const canEditPhone = isGmailUser && !phoneVerified;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    setIsModified(val.trim() !== initialName.trim() || (canEditPhone && phoneInput.trim() !== ''));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhoneInput(val);
    setIsModified(true);
  };

  // Phone OTP verification flow
  const startPhoneVerification = () => {
    if (!phoneInput || !/^[6-9]\d{9}$/.test(phoneInput.trim())) {
      addToast('Please enter a valid 10-digit Indian mobile number', 'error');
      return;
    }

    const finalClientId = process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID || '17565400827940866842';
    const redirectUrl = window.location.origin + '/phone-callback';
    const authUrl = `https://auth.phone.email/log-in?client_id=${finalClientId}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    sessionStorage.setItem('pending_signup_phone', phoneInput.trim());
    sessionStorage.setItem('auth_flow_origin', 'profile');

    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      authUrl,
      'phone_email_popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  // Listen for OTP verification from popup
  React.useEffect(() => {
    if (!canEditPhone) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'PHONE_EMAIL_VERIFIED') return;

      const token = event.data.accessToken;
      setIsVerifyingPhone(true);

      try {
        // First verify the phone
        const verifyRes = await fetch('/api/auth/verify-phone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token }),
        });

        const verifyData = await verifyRes.json();

        if (verifyRes.ok && verifyData.success) {
          // Now update the profile with the verified phone
          const updateRes = await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              phone: phoneInput.trim(),
            }),
          });

          const updateData = await updateRes.json();
          if (updateRes.ok && updateData.success) {
            setPhoneVerified(true);
            setIsModified(false);
            addToast('Phone number verified and saved!', 'success');
            await refreshUser();
          } else {
            addToast(updateData.error || 'Failed to save phone number', 'error');
          }
        } else {
          addToast(verifyData.error || 'Phone verification failed', 'error');
        }
      } catch (err) {
        console.error('Phone verification error:', err);
        addToast('Verification error. Please try again.', 'error');
      } finally {
        setIsVerifyingPhone(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [canEditPhone, phoneInput, name, addToast, refreshUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (name.trim().length < 2) {
      addToast('Name must be at least 2 characters', 'error');
      return;
    }

    // If Gmail user is adding a phone, require verification first
    if (canEditPhone && phoneInput.trim() && !phoneVerified) {
      addToast('Please verify your phone number first using the Verify button', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addToast('Profile updated successfully', 'success');
        setIsModified(false);
        // Refresh the global auth state
        await refreshUser();
      } else {
        addToast(data.error || 'Failed to update profile', 'error');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      addToast('An error occurred. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-zinc-950 border border-zinc-850 p-6 md:p-8 rounded-xl space-y-6">
      <div className="border-b border-zinc-900 pb-4">
        <h2 className="text-lg font-black uppercase tracking-widest font-mono flex items-center gap-2">
          <User className="w-5 h-5 text-zinc-400" />
          Profile Details
        </h2>
        <p className="text-[10px] text-zinc-550 font-mono uppercase tracking-wider mt-1">
          Manage your account information and contact details.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name Input */}
          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono font-bold block">
              Full Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter your full name"
                className="w-full bg-white text-black px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 uppercase tracking-widest font-mono"
                required
                disabled={isSaving}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                <Edit2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label className="text-[9px] uppercase tracking-widest text-zinc-400 font-mono font-bold block flex items-center gap-1.5">
              Phone Number
              {!canEditPhone && <Lock className="w-2.5 h-2.5 text-zinc-550" />}
              {phoneVerified && <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" />}
            </label>

            {canEditPhone ? (
              /* Gmail user — editable phone with verify button */
              <div className="space-y-2">
                <div className="relative flex">
                  <span className="bg-zinc-900 border border-r-0 border-zinc-800 text-zinc-400 px-3 py-3 text-xs flex items-center font-mono">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={handlePhoneChange}
                    placeholder="Enter 10-digit number"
                    maxLength={10}
                    className="flex-1 bg-white text-black px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 tracking-widest font-mono"
                    disabled={isVerifyingPhone}
                  />
                </div>
                <button
                  type="button"
                  onClick={startPhoneVerification}
                  disabled={isVerifyingPhone || !/^[6-9]\d{9}$/.test(phoneInput)}
                  className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    isVerifyingPhone || !/^[6-9]\d{9}$/.test(phoneInput)
                      ? 'bg-zinc-900 border border-zinc-850 text-zinc-550 cursor-not-allowed'
                      : 'bg-white hover:bg-zinc-200 text-black cursor-pointer'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  {isVerifyingPhone ? 'Verifying...' : 'Verify Phone via OTP'}
                </button>
              </div>
            ) : (
              /* Phone user OR already verified — read only */
              <>
                <div className="relative">
                  <input
                    type="text"
                    value={phoneInput || phone}
                    disabled
                    className="w-full bg-zinc-900/50 border border-zinc-850 text-zinc-500 px-4 py-3 text-xs font-mono tracking-widest cursor-not-allowed select-none"
                  />
                </div>
                <p className="text-[9px] text-zinc-650 font-mono uppercase">
                  {phoneVerified
                    ? 'Phone number is verified and cannot be changed.'
                    : 'No phone number on file.'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!isModified || isSaving || (canEditPhone && !!phoneInput.trim() && !phoneVerified)}
            className={`w-full md:w-auto px-8 py-3.5 text-xs font-bold uppercase tracking-widest transition-all duration-200 flex items-center justify-center gap-2 ${
              isModified && !isSaving
                ? 'bg-white hover:bg-zinc-200 text-black cursor-pointer'
                : 'bg-zinc-900 border border-zinc-850 text-zinc-550 cursor-not-allowed'
            }`}
          >
            {isSaving ? (
              <>Saving Changes...</>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Save Details
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
