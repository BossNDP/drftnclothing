'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCartStore } from '@/lib/cartStore';
import { getOptimizedImageUrl } from '@/lib/cloudinary';
import { ChevronLeft, Lock, CheckCircle, Package, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';
import { useToast } from '@/components/ToastContainer';
import { useAuthSession } from '@/context/AuthContext';
import CheckoutCoupon from '@/components/CheckoutCoupon';

import { useRouter } from 'next/navigation';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getCartTotal, discountCode, clearCart } = useCartStore();
  const { addToast } = useToast();
  const { isSignedIn, isLoaded, user, openAuthModal, refreshUser } = useAuthSession();
  
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shippingProvider, setShippingProvider] = useState<'standard' | 'express'>('standard');

  const [checkoutEligibility, setCheckoutEligibility] = useState<{
    borzoEligible: boolean;
    extraCharge: number;
    shiprocketAvailable: boolean;
    estimatedStandardDays: number;
  } | null>(null);
  const [checkingCheckoutEligibility, setCheckingCheckoutEligibility] = useState(false);

  const triggerCheckoutEligibilityCheck = async (pin: string) => {
    if (!/^\d{6}$/.test(pin)) return;
    setCheckingCheckoutEligibility(true);
    try {
      const res = await fetch(`/api/shipping/serviceability?pincode=${pin}`);
      if (res.ok) {
        const data = await res.json();
        setCheckoutEligibility(data);
        if (!data.borzoEligible) {
          setShippingProvider('standard');
        }
      } else {
        setCheckoutEligibility(null);
        setShippingProvider('standard');
      }
    } catch (err) {
      console.error('Checkout serviceability check failure:', err);
      setCheckoutEligibility(null);
      setShippingProvider('standard');
    } finally {
      setCheckingCheckoutEligibility(false);
    }
  };



  const isExpressPincode = (pincode: string, rangesStr: string): boolean => {
    const pin = Number(pincode.trim());
    if (isNaN(pin) || !rangesStr) return false;

    const parts = rangesStr.split(',').map(s => s.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = Number(startStr);
        const end = Number(endStr);
        if (!isNaN(start) && !isNaN(end) && pin >= start && pin <= end) {
          return true;
        }
      } else {
        const exact = Number(part);
        if (!isNaN(exact) && pin === exact) {
          return true;
        }
      }
    }
    return false;
  };

  const getExpressPromise = () => {
    const startStr = storeConfig.borzoCutoffStart || '11:00';
    const endStr = storeConfig.borzoCutoffEnd || '16:00';
    
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };
      const formatter = new Intl.DateTimeFormat([], options);
      const timeStr = formatter.format(new Date());
      
      if (timeStr >= startStr && timeStr <= endStr) {
        return `Same-day 120-min delivery (Placed within ${startStr} - ${endStr})`;
      } else {
        return `Next-day morning delivery (Placed outside ${startStr} - ${endStr})`;
      }
    } catch (e) {
      return 'Same-day 120-min delivery';
    }
  };
  
  // Checkout steps: 1 = Contact & Shipping, 2 = Payment, 3 = Confirmation
  const [currentStep, setCurrentStep] = useState(1);
  const [successOrderInfo, setSuccessOrderInfo] = useState<{ number: string; total: number } | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');

  // Phone.Email OTP verification state
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [verifiedPhoneToken, setVerifiedPhoneToken] = useState<string | null>(null);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);

  // Inline Checkout Verification States (for logged-out users)
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlineTerms, setInlineTerms] = useState(false);
  const [inlineNotifOptIn, setInlineNotifOptIn] = useState(true);
  const [inlineStep, setInlineStep] = useState<'phone' | 'profile'>('phone');
  const [inlineTempToken, setInlineTempToken] = useState<string | null>(null);
  const [inlineName, setInlineName] = useState('');
  const [inlineEmail, setInlineEmail] = useState('');

  // Dynamic store configuration
  const [storeConfig, setStoreConfig] = useState({
    razorpayActive: false,
    razorpayKeyId: '',
    freeShippingThreshold: 0,
    defaultShippingCharge: 0,
    codFee: 0,
    whatsappNumber: '+917406164512',
    borzoCutoffStart: '11:00',
    borzoCutoffEnd: '16:00',
    blrPincodeRanges: '560001-560300',
    borzoSurcharge: 15000,
    borzoFreeThreshold: 149900,
  });

  // Form inputs state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });

  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');

  // Re-run checking whenever pincode changes and reaches 6 digits
  useEffect(() => {
    if (formData.pincode && formData.pincode.length === 6) {
      triggerCheckoutEligibilityCheck(formData.pincode);
    } else {
      setCheckoutEligibility(null);
    }
  }, [formData.pincode]);

  // Fetch settings on mount
  useEffect(() => {
    setMounted(true);
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setStoreConfig(data);
          // If Razorpay is not active, default to COD or manual
          if (!data.razorpayActive) {
            setPaymentMethod('cod');
          }
        }
      } catch (err) {
        console.error('Failed to load store configurations:', err);
      }
    };
    fetchConfig();
  }, []);

  // Strip +91 / 91 prefix to always keep a clean 10-digit number
  const normalisePhone = (raw: string | null | undefined): string => {
    if (!raw) return '';
    const s = raw.trim();
    if (s.startsWith('+91') && s.length === 13) return s.slice(3);
    if (s.startsWith('91') && s.length === 12) return s.slice(2);
    return s;
  };

  // Pre-fill user data on login
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const cleanPhone = normalisePhone(user.phone);
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || cleanPhone,
      }));
      if (user.phone) {
        // Store the normalised 10-digit form so comparisons always work
        setVerifiedPhone(cleanPhone || user.phone);
        setVerifiedPhoneToken('session_verified_phone');
      }
    }
  }, [isLoaded, isSignedIn, user]);

  // Listen for message from phone-callback popup window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'PHONE_EMAIL_VERIFIED') {
        const token = event.data.accessToken;
        setIsVerifyingPhone(true);
        try {
          const phoneToVerify = isSignedIn ? formData.phone : inlinePhone;
          const res = await fetch('/api/auth/verify-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: phoneToVerify.trim(),
              accessToken: token,
              notificationsOptIn: inlineNotifOptIn,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            if (data.isNewUser) {
              setInlineTempToken(data.tempToken);
              setInlineStep('profile');
              addToast('Phone number verified. Please complete your name.', 'success');
            } else {
              setVerifiedPhone(normalisePhone(data.user.phone));
              setVerifiedPhoneToken('session_verified_phone');
              addToast('Verified successfully!', 'success');
              // Update unified context
              await refreshUser();
            }
          } else {
            addToast(data.error || 'Failed to verify phone OTP', 'error');
          }
        } catch (err) {
          console.error('Error verifying phone:', err);
          addToast('Error verifying phone verification token', 'error');
        } finally {
          setIsVerifyingPhone(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [inlinePhone, inlineNotifOptIn, isSignedIn, formData.phone, addToast]);

  const startPhoneVerification = () => {
    const phoneToVerify = isSignedIn ? formData.phone : inlinePhone;
    if (!phoneToVerify || !/^[6-9]\d{9}$/.test(phoneToVerify.trim())) {
      addToast('Please enter a valid 10-digit Indian mobile number first.', 'error');
      return;
    }
    
    const finalClientId = process.env.NEXT_PUBLIC_PHONE_EMAIL_CLIENT_ID || '17565400827940866842';
    const redirectUrl = window.location.origin + '/phone-callback';
    const authUrl = `https://auth.phone.email/log-in?client_id=${finalClientId}&redirect_url=${encodeURIComponent(redirectUrl)}`;
    
    // Save details to sessionStorage in case verification loads in main tab
    sessionStorage.setItem('pending_signup_phone', phoneToVerify.trim());
    sessionStorage.setItem('pending_signup_name', (isSignedIn ? formData.name : inlineName) || 'Customer');
    sessionStorage.setItem('pending_signup_notifications', inlineNotifOptIn ? 'true' : 'false');
    sessionStorage.setItem('auth_flow_origin', 'checkout');

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

  const handleInlineProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineName.trim()) {
      addToast('Name is required', 'error');
      return;
    }

    setIsVerifyingPhone(true);
    try {
      const res = await fetch('/api/auth/register-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineName.trim(),
          email: inlineEmail.trim() || undefined,
          tempToken: inlineTempToken,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVerifiedPhone(data.user.phone);
        setVerifiedPhoneToken('session_verified_phone');
        addToast('Profile setup complete!', 'success');
        await refreshUser();
      } else {
        addToast(data.error || 'Failed to complete profile registration', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Profile registration error', 'error');
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Helper to calculate pricing breakdowns in paise
  const calculateTotalBreakdown = () => {
    const subtotal = getCartTotal(); // in paise
    let discount = 0;

    if (discountCode) {
      if (discountCode.discount_type === 'percent') {
        discount = Math.round(subtotal * (discountCode.discount_value / 100));
      } else {
        discount = discountCode.discount_value;
      }
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);
    
    // Check if express is available and selected
    const expressAvailable = fulfillmentType === 'delivery' && !!checkoutEligibility?.borzoEligible;
    const expressCharge = expressAvailable 
      ? (discountedSubtotal >= (storeConfig.borzoFreeThreshold ?? 149900) ? 0 : (checkoutEligibility?.extraCharge ?? 150) * 100)
      : 0;

    // Shipping calculation (Free Shipping Sale: Standard delivery is 100% FREE, 0 shipping charge)
    let shippingCharge = 0;
    if (fulfillmentType === 'delivery') {
      if (shippingProvider === 'express' && expressAvailable) {
        shippingCharge = expressCharge;
      } else {
        shippingCharge = 0; // Free Shipping Sale
      }
    }

    return {
      subtotal,
      discount,
      shippingCharge,
      expressCharge,
      total: discountedSubtotal + shippingCharge,
    };
  };

  const loadRazorpaySDK = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

function isGibberishText(str: string): boolean {
  const clean = str.trim().toLowerCase();
  if (clean.length < 5) return true;
  if (/^(.)\1+$/.test(clean)) return true;
  const mashPatterns = [
    'asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl',
    'qwert', 'werty', 'ertyu', 'rtyui', 'tyuio', 'yuiop',
    'zxcv', 'xcvb', 'cvbn', 'vbnm', '1234', '2345', '3456', '4567',
    'test', 'aaaa', 'bbbb', 'cccc', 'xxxx', 'yyyy', 'zzzz'
  ];
  for (const pat of mashPatterns) {
    if (clean.includes(pat) && clean.length < 12) return true;
  }
  const words = clean.split(/[\s,.-]+/).filter(w => w.length > 0);
  if (words.length < 2) return true;
  return false;
}

  // Validates step 1 inputs
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validations
    if (!formData.name.trim()) return addToast('Name is required', 'error');
    if (!formData.email.trim() || !formData.email.includes('@')) return addToast('Please enter a valid email address', 'error');
    if (!/^[6-9]\d{9}$/.test(formData.phone.trim())) return addToast('Please enter a valid 10-digit Indian mobile number', 'error');

    // Ensure phone has been verified
    const cleanPhone = formData.phone.trim();
    const normVerified = normalisePhone(verifiedPhone);
    const isMatched = normVerified === cleanPhone || verifiedPhone === cleanPhone || verifiedPhone === `+91${cleanPhone}`;
    if (!verifiedPhone || !isMatched) {
      return addToast('Please verify your mobile number to proceed.', 'error');
    }
    
    if (fulfillmentType === 'delivery') {
      if (!formData.line1.trim() || isGibberishText(formData.line1)) {
        return addToast('Please enter a valid, complete delivery address (no random letters)', 'error');
      }
      if (!formData.city.trim() || isGibberishText(formData.city + ' ' + formData.city)) {
        return addToast('Please enter a valid city name', 'error');
      }
      if (!formData.state.trim()) return addToast('State is required', 'error');
      if (!/^\d{6}$/.test(formData.pincode.trim())) return addToast('Please enter a valid 6-digit Indian PIN code', 'error');
    }

    setCurrentStep(2);
    window.scrollTo(0, 0);
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    const breakdown = calculateTotalBreakdown();

    try {
      // 1. Call Create Order API with a 15-second client-side timeout as a safety net.
      // This ensures the spinner never hangs indefinitely even if the server fails silently.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      let res: Response;
      try {
        res = await fetch('/api/orders/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            items: items.map((i) => ({ productId: i.id, size: i.size, quantity: i.quantity })),
            discountCode: discountCode?.code || undefined,
            paymentMethod: paymentMethod,
            fulfillmentType: fulfillmentType,
            shippingProvider: fulfillmentType === 'delivery' ? shippingProvider : undefined,
            verifiedPhone: verifiedPhone || undefined,
            verifiedPhoneToken: verifiedPhoneToken || undefined,
            customerInfo: {
              name: formData.name.trim(),
              email: formData.email.trim(),
              phone: formData.phone.trim(),
              address: fulfillmentType === 'delivery' ? {
                line1: formData.line1.trim(),
                line2: formData.line2 ? formData.line2.trim() : undefined,
                city: formData.city.trim(),
                state: formData.state.trim(),
                pincode: formData.pincode.trim(),
              } : null,
            },
          }),
        });
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') {
          throw new Error('Checkout timed out. Please try again.');
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Order creation failed:', errorData);
        let errorMsg = errorData.error || 'Failed to place order';
        if (errorData.details) {
           errorMsg += ' (Check console for details)';
        }
        throw new Error(errorMsg);
      }

      const orderData = await res.json();

      // Scenario A: Online Payment via Razorpay (Prepaid & COD Deposit)
      if (storeConfig.razorpayActive && orderData.razorpayOrderId) {
        const sdkLoaded = await loadRazorpaySDK();
        if (!sdkLoaded) {
          console.error('[Checkout] Razorpay SDK failed to load');
          throw new Error('Payment gateway failed to load. Please check your network and try again.');
        }

        const isCodDeposit = paymentMethod === 'cod';

        const options = {
          key: storeConfig.razorpayKeyId,
          amount: orderData.amount, // ₹200 for COD deposit, or total for prepaid
          currency: 'INR',
          name: 'DRFTN CLOTHING',
          description: isCodDeposit ? '₹200 COD Deposit Payment' : 'Drift in Style - Streetwear Order',
          order_id: orderData.razorpayOrderId,
          prefill: {
            name: formData.name,
            email: formData.email,
            contact: formData.phone,
          },
          theme: {
            color: '#E63329',
          },
          handler: async function (response: any) {
            setIsProcessing(true);
            try {
              const verifyRes = await fetch('/api/orders/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  orderId: orderData.orderId,
                }),
              });

              if (!verifyRes.ok) {
                const verifyError = await verifyRes.json();
                console.error('[Checkout Handler] Server payment verification failed:', verifyError);
                throw new Error(verifyError.error || 'Server signature verification failed');
              }

              const verifyData = await verifyRes.json();
              if (verifyData.success) {
                addToast(
                  isCodDeposit
                    ? '₹200 COD deposit verified! Order confirmed.'
                    : 'Payment successful! Order confirmed.',
                  'success'
                );
                clearCart();
                router.push(`/order-confirmation/${orderData.orderId}`);
              }
            } catch (err: any) {
              console.error('[Checkout Handler] Error during payment verification:', err);
              addToast(err.message || 'Payment verification failed', 'error');
            } finally {
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: function () {
              console.warn('[Checkout Modal] Razorpay payment modal dismissed by user.');
              setIsProcessing(false);
              addToast(
                isCodDeposit
                  ? 'COD deposit payment was cancelled. Your order has not been placed.'
                  : 'Payment cancelled by user. Order not placed.',
                'error'
              );
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          console.error('[Checkout Modal] Razorpay payment failed event:', resp.error);
          setIsProcessing(false);
          addToast(`Payment failed: ${resp.error?.description || 'Transaction declined'}`, 'error');
        });
        rzp.open();
        // Do NOT reset isProcessing here — the modal handler / ondismiss will do it
        return;
      } 
      // Scenario B: Manual Fallback (Only when Razorpay is inactive on the store)
      else {
        console.warn('[Checkout] Razorpay gateway is inactive. Using manual WhatsApp ordering flow.');
        addToast('Order placed. Redirecting to WhatsApp to complete payment...', 'success');
        
        // Prepare pre-filled WhatsApp message
        const itemsListText = items
          .map((i) => `• ${i.name} (Size: ${i.size}) x ${i.quantity}`)
          .join('%0A');
        
        const messageText = `Hello DRFTN CLOTHING! I'd like to complete my streetwear order.%0A%0A*Order Number:* ${orderData.orderNumber}%0A*Customer:* ${formData.name}%0A*Phone:* ${formData.phone}%0A*Address:* ${formData.line1 || 'Store Pickup'}, ${formData.city || 'Bengaluru'} - ${formData.pincode || '560038'}%0A%0A*Items:*%0A${itemsListText}%0A%0A*Total Amount:* ₹${(breakdown.total / 100).toFixed(2)}`;
        
        const whatsappUrl = `https://wa.me/${storeConfig.whatsappNumber.replace('+', '')}?text=${messageText}`;
        
        window.open(whatsappUrl, '_blank');

        clearCart();
        router.push(`/order-confirmation/${orderData.orderId}`);
      }

    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      // Always reset processing state on any error or non-Razorpay success.
      // Razorpay flows return early above; all other paths must clear the spinner here.
      setIsProcessing(false);
    }
  };

  if (!mounted || !isLoaded) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-brand-black text-zinc-500 font-bold uppercase tracking-widest text-xs">
        Loading Secure Checkout...
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 bg-brand-black text-brand-offwhite animate-fade-in">
        <div className="w-full max-w-md bg-zinc-950 border border-white/10 p-6 md:p-8 flex flex-col items-center gap-6 shadow-[0_0_80px_rgba(0,0,0,0.9)]">
          <div className="relative w-44 h-12 select-none mb-2">
            <img src="/logo.png?v=3" alt="DRFTN" className="object-contain w-full h-full grayscale brightness-[100]" />
          </div>

          {inlineStep === 'phone' ? (
            <div className="w-full space-y-5">
              <div className="text-center space-y-2">
                <h2 className="text-base font-black uppercase text-white tracking-widest">Checkout Verification</h2>
                <p className="text-xs text-zinc-400 uppercase tracking-wider leading-relaxed">
                  Verify your mobile number to complete secure checkout.
                </p>
              </div>

              <div className="space-y-4 font-body">
                {/* Mobile number input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                    Indian Mobile Number
                  </label>
                  <div className="relative flex">
                    <span className="bg-zinc-900 border border-r-0 border-zinc-800 text-zinc-400 px-3 py-3 text-xs flex items-center font-mono">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="7406164512"
                      value={inlinePhone}
                      onChange={(e) => setInlinePhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-zinc-900/60 border border-zinc-800 text-white px-4 py-3 text-xs focus:outline-none focus:border-white transition-colors font-mono tracking-widest"
                    />
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={inlineTerms}
                      onChange={(e) => setInlineTerms(e.target.checked)}
                      className="mt-0.5 accent-white shrink-0"
                    />
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider leading-relaxed">
                      I accept the{' '}
                      <a href="/policies/terms-and-conditions" target="_blank" className="text-white underline">
                        Terms & Conditions
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
                      checked={inlineNotifOptIn}
                      onChange={(e) => setInlineNotifOptIn(e.target.checked)}
                      className="mt-0.5 accent-white shrink-0"
                    />
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider leading-relaxed">
                      Notify me about restocks, drops & order updates
                    </span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="button"
                  onClick={startPhoneVerification}
                  disabled={isVerifyingPhone || !inlineTerms}
                  className="w-full bg-white hover:bg-zinc-200 text-black py-3.5 font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2 cursor-pointer border border-white"
                >
                  {isVerifyingPhone ? 'Verifying OTP...' : 'Send OTP via phone.email'}
                </button>

                <div className="relative py-2 text-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                  <span className="relative bg-zinc-950 px-3 text-[9px] uppercase tracking-widest font-mono text-zinc-550">
                    Or Continue With
                  </span>
                </div>

                <button
                  onClick={() => openAuthModal('google')}
                  className="w-full bg-transparent hover:bg-white/5 text-white border border-white/10 py-3.5 font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  Google Account
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInlineProfileSubmit} className="w-full space-y-4 font-body animate-fade-in">
              <div className="text-center space-y-2">
                <h3 className="text-base font-black uppercase text-white tracking-widest">Complete Profile</h3>
                <p className="text-xs text-zinc-400 uppercase tracking-wider leading-relaxed">
                  Enter your name to complete secure checkout registration.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Nagarjun D P"
                    value={inlineName}
                    onChange={(e) => setInlineName(e.target.value)}
                    className="w-full bg-zinc-900/60 border border-zinc-800 text-white px-4 py-3 text-xs focus:outline-none focus:border-white transition-colors uppercase tracking-widest font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. user@domain.com"
                    value={inlineEmail}
                    onChange={(e) => setInlineEmail(e.target.value)}
                    className="w-full bg-zinc-900/60 border border-zinc-800 text-white px-4 py-3 text-xs focus:outline-none focus:border-white transition-colors font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifyingPhone}
                className="w-full bg-white hover:bg-zinc-200 text-black py-3.5 font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
              >
                {isVerifyingPhone ? 'Saving details...' : 'Proceed to Checkout Details'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (currentStep === 3 && successOrderInfo) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in bg-brand-black text-brand-offwhite">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-widest text-brand-offwhite mb-4 uppercase">Order Confirmed</h1>
        <p className="text-zinc-400 mb-8 max-w-md mx-auto text-sm">
          Thank you for choosing DRFTN CLOTHING. Your order <span className="text-brand-offwhite font-bold">{successOrderInfo.number}</span> has been successfully logged.
        </p>
        <div className="bg-zinc-900/40 border border-zinc-800 p-6 w-full max-w-sm mb-8">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-zinc-500 uppercase tracking-wider text-xs">Total Amount</span>
            <span className="text-brand-offwhite font-bold font-mono">₹{successOrderInfo.total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-500 uppercase tracking-wider text-xs">Status</span>
            <span className={paymentMethod === 'cod' ? 'text-yellow-500 font-bold uppercase text-xs' : 'text-green-500 font-bold uppercase text-xs'}>
              {paymentMethod === 'cod' ? 'COD - Pending' : 'Paid'}
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-800 text-[11px] text-zinc-500 uppercase tracking-widest">
            Estimated Delivery: 3-5 Business Days
          </div>
        </div>
        <div className="flex gap-4">
          <Link href="/shop" className="bg-white text-black px-8 py-3.5 font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors">
            Continue Shopping
          </Link>
          <Link href="/track" className="bg-transparent border border-zinc-700 text-brand-offwhite px-8 py-3.5 font-bold uppercase tracking-widest text-xs hover:bg-zinc-800 transition-colors">
            Track Order
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center bg-brand-black text-brand-offwhite">
        <Package className="w-16 h-16 text-zinc-800 mb-6" />
        <h2 className="text-2xl font-bold text-brand-offwhite mb-4 uppercase tracking-wider">Cart is Empty</h2>
        <p className="text-zinc-500 mb-8 max-w-sm mx-auto text-xs">
          You have no streetwear items in your cart to checkout. Head back to the shop to browse.
        </p>
        <Link href="/shop" className="bg-white text-black px-8 py-3.5 font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors">
          Return to Shop
        </Link>
      </div>
    );
  }

  const { subtotal, discount, shippingCharge, total } = calculateTotalBreakdown();

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 bg-brand-black text-brand-offwhite">
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-900">
        <button
          onClick={() => {
            if (currentStep === 2) setCurrentStep(1);
          }}
          className={`inline-flex items-center text-xs uppercase tracking-wider font-bold transition-colors ${
            currentStep === 1 ? 'text-zinc-500 hover:text-brand-offwhite cursor-pointer' : 'text-zinc-400 hover:text-white cursor-pointer'
          }`}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {currentStep === 2 ? 'Back to Details' : 'Checkout'}
        </button>
        
        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <span className={currentStep === 1 ? 'text-white' : 'text-zinc-500'}>01 Details</span>
          <span className="text-zinc-700">/</span>
          <span className={currentStep === 2 ? 'text-white' : 'text-zinc-500'}>02 Payment</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Column: Form Details / Payment Selection */}
        <div className="lg:col-span-7 xl:col-span-8">
          
          {currentStep === 1 ? (
            <form onSubmit={handleProceedToPayment} className="space-y-8 animate-fade-in">
              {/* Contact Info */}
              <section className="space-y-4">
                <h2 className="text-base font-bold text-brand-offwhite uppercase tracking-wider border-b border-zinc-900 pb-2 flex items-center justify-between">
                  <span>1. Contact Details & Mobile Verification</span>
                  {!verifiedPhone && (
                    <span className="text-[10px] font-mono text-amber-400 tracking-wider font-normal">
                      VERIFICATION REQUIRED
                    </span>
                  )}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone Verification at TOP */}
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">Mobile Phone Number (10-digit OTP Verification)</label>
                    {verifiedPhone ? (
                      <div className="relative flex">
                        <input
                          type="tel"
                          name="phone"
                          required
                          disabled
                          value={formData.phone}
                          className="w-full bg-zinc-900/20 border border-emerald-500/30 text-emerald-400 px-4 py-3 text-sm focus:outline-none font-mono"
                        />
                        <div className="absolute right-2 top-3 flex items-center gap-1 text-emerald-400 text-[9px] font-bold uppercase tracking-wider select-none">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" /> Verified
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex">
                        <input
                          type="tel"
                          name="phone"
                          required
                          placeholder="e.g. 7406164512"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full bg-zinc-900/50 border border-amber-500/40 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={startPhoneVerification}
                          disabled={isVerifyingPhone}
                          className="absolute right-2 top-1.5 bg-amber-400 hover:bg-amber-300 text-black text-[9px] font-bold uppercase tracking-widest px-3 py-2 cursor-pointer transition-colors rounded"
                        >
                          {isVerifyingPhone ? 'Verifying...' : 'Verify OTP'}
                        </button>
                      </div>
                    )}
                    {!verifiedPhone && (
                      <span className="text-[9px] text-amber-400 uppercase tracking-wider block font-mono">
                        ⚡ You must verify your mobile number before entering shipping details.
                      </span>
                    )}
                    {verifiedPhone && user?.authProvider === 'google' && (
                      <button
                        type="button"
                        onClick={() => { setVerifiedPhone(null); setVerifiedPhoneToken(null); }}
                        className="text-[9px] text-zinc-500 underline uppercase tracking-wider hover:text-white mt-1 cursor-pointer block"
                      >
                        Use different number
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Nagarjun D P"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full bg-zinc-900/50 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="e.g. user@domain.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full bg-zinc-900/50 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                    />
                  </div>
                </div>
              </section>
              {/* Fulfillment Option Selector */}
              <section className="space-y-4">
                <h2 className="text-base font-bold text-brand-offwhite uppercase tracking-wider border-b border-zinc-900 pb-2">Fulfillment Method</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('delivery')}
                    className={`p-4 border font-bold uppercase tracking-wider text-xs transition-all flex flex-col items-center gap-2 ${
                      fulfillmentType === 'delivery' 
                        ? 'border-white bg-white/5 text-white' 
                        : 'border-zinc-850 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <Package className="w-5 h-5" />
                    <span>Home Delivery</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFulfillmentType('pickup')}
                    className={`p-4 border font-bold uppercase tracking-wider text-xs transition-all flex flex-col items-center gap-2 ${
                      fulfillmentType === 'pickup' 
                        ? 'border-white bg-white/5 text-white' 
                        : 'border-zinc-850 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                    <span>Store Pickup</span>
                  </button>
                </div>
              </section>

              {/* Shipping Info / Store Info conditional */}
              {fulfillmentType === 'delivery' ? (
                <section className="space-y-4 animate-fade-in">
                  <h2 className="text-base font-bold text-brand-offwhite uppercase tracking-wider border-b border-zinc-900 pb-2">Shipping Address</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">Address Line 1</label>
                      <input
                        type="text"
                        name="line1"
                        required
                        placeholder="Street address, P.O. box, company name"
                        value={formData.line1}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-900/50 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">Apartment, suite, unit (optional)</label>
                      <input
                        type="text"
                        name="line2"
                        placeholder="Apartment, suite, unit, building, floor"
                        value={formData.line2}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-900/50 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">City</label>
                      <input
                        type="text"
                        name="city"
                        required
                        placeholder="e.g. Yelahanka, Bengaluru"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-900/50 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">State</label>
                      <input
                        type="text"
                        name="state"
                        required
                        placeholder="e.g. Karnataka"
                        value={formData.state}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-900/50 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5 font-mono">
                      <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block">PIN Code (6-digit)</label>
                      <input
                        type="text"
                        name="pincode"
                        required
                        placeholder="e.g. 560064"
                        value={formData.pincode}
                        onChange={handleInputChange}
                        className="w-full bg-zinc-900/50 border border-zinc-800 text-brand-offwhite px-4 py-3 text-sm focus:outline-none focus:border-white focus:bg-zinc-900 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Delivery Option Selector (Express vs Standard) */}
                  {fulfillmentType === 'delivery' && formData.pincode.length === 6 && (
                    <div className="mt-4 p-4 border border-zinc-850 bg-zinc-950/60 rounded-lg space-y-3 text-left">
                      <label className="text-xs uppercase tracking-widest text-zinc-400 font-bold block">
                        Choose Delivery Speed
                      </label>
                      
                      <div className="space-y-2">
                        {/* Standard Delivery Option */}
                        <label className={`flex items-start gap-3 p-3 border transition-colors cursor-pointer rounded-lg ${
                          shippingProvider === 'standard' ? 'border-white bg-zinc-900/40' : 'border-zinc-850 bg-zinc-950/20'
                        }`}>
                          <input
                            type="radio"
                            name="shipping_provider"
                            checked={shippingProvider === 'standard'}
                            onChange={() => setShippingProvider('standard')}
                            className="mt-1 accent-white"
                          />
                          <div className="flex-1">
                            <span className="font-bold text-xs block text-brand-offwhite uppercase tracking-wider">Standard Delivery</span>
                            <span className="text-[10px] text-zinc-500 block mt-0.5">
                              ₹{shippingProvider === 'standard' ? (calculateTotalBreakdown().shippingCharge / 100).toFixed(0) : (subtotal >= storeConfig.freeShippingThreshold ? '0' : (storeConfig.defaultShippingCharge / 100).toFixed(0))} • Delivery in {checkoutEligibility?.estimatedStandardDays ?? 4-6} business days
                            </span>
                          </div>
                        </label>

                        {/* Express Delivery Option — COMING SOON */}
                        <div className="flex items-start gap-3 p-3.5 border border-zinc-800 bg-zinc-950/30 rounded-lg opacity-65 select-none relative overflow-hidden">
                          <input
                            type="radio"
                            name="shipping_provider"
                            disabled
                            checked={false}
                            className="mt-1 accent-zinc-500 cursor-not-allowed"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs block text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                                ⚡ Express 120-Min Delivery (Borzo)
                              </span>
                              <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold tracking-widest uppercase">
                                COMING SOON
                              </span>
                            </div>
                            <span className="text-[10px] text-zinc-500 block mt-1 font-mono">
                              Same-day hyper-local delivery in Bengaluru is currently under API integration. Standard shipping available.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              ) : (
                <section className="space-y-4 animate-fade-in bg-zinc-950/60 border border-zinc-850 p-5 rounded-lg">
                  <h2 className="text-xs font-black uppercase text-white tracking-widest flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-white" />
                    Collection Point Info
                  </h2>
                  <div className="space-y-3 font-mono text-xs text-zinc-400">
                    <p className="text-white font-bold">DRFTN STORE</p>
                    <p>1st Floor, Kogilu Main Rd, above Sri Venkateshwar Vaibhava Veg Hotel, K B Sandra, Maruthi Nagar, Yelahanka, Bengaluru, Karnataka - 560064</p>
                    <p className="mt-2 text-zinc-500">
                      🕒 <strong>Hours:</strong> Mon - Sun, 11:00 AM - 09:00 PM
                    </p>
                    <p className="text-[10px] text-zinc-500 border-t border-zinc-900 pt-2 leading-relaxed">
                      Your 6-digit pickup code will be generated instantly after payment verification. Bring it to the counter to collect your fit.
                    </p>
                  </div>
                </section>
              )}

              {/* Submit Details to Proceed */}
              <button
                type="submit"
                className="w-full bg-brand-offwhite text-brand-black py-4 font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                Proceed to Payment
                <ArrowRight className="w-4 h-4" />
              </button>
              
              {/* Trust Badge Strip */}
              <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-zinc-500 font-mono tracking-wider">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-zinc-650" /> SSL SECURED
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-zinc-650" /> SECURE CHECKOUT
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3 text-zinc-650" /> 3-DAY RETURNS
                </span>
              </div>
            </form>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <section className="space-y-4">
                <h2 className="text-base font-bold text-brand-offwhite uppercase tracking-wider border-b border-zinc-900 pb-2">Select Payment Method</h2>
                
                {storeConfig.razorpayActive ? (
                  <div className="space-y-4">
                    {/* Razorpay Option */}
                    <label className={`flex items-start gap-4 p-5 border transition-colors cursor-pointer rounded-lg ${
                      paymentMethod === 'razorpay' ? 'border-white bg-zinc-900/40' : 'border-zinc-800 bg-zinc-900/10'
                    }`}>
                      <input
                        type="radio"
                        name="payment_method"
                        checked={paymentMethod === 'razorpay'}
                        onChange={() => setPaymentMethod('razorpay')}
                        className="mt-1 accent-white"
                      />
                      <div className="flex-1">
                        <span className="font-bold text-sm block uppercase tracking-wider text-brand-offwhite">Prepaid - Debit/Credit Card / UPI</span>
                        <span className="text-xs text-zinc-500 mt-1 block">Pay securely online using Razorpay payment gateway. Fast processing.</span>
                      </div>
                    </label>

                    {/* COD Option */}
                    {shippingProvider !== 'express' && (
                      <div className={`p-5 border border-zinc-800 bg-zinc-900/10 rounded-lg transition-colors ${
                        paymentMethod === 'cod' ? 'border-white bg-zinc-900/40' : 'border-zinc-800 bg-zinc-900/10'
                      }`}>
                        <label className="flex items-start gap-4 cursor-pointer">
                          <input
                            type="radio"
                            name="payment_method"
                            checked={paymentMethod === 'cod'}
                            onChange={() => setPaymentMethod('cod')}
                            className="mt-1 accent-white"
                          />
                          <div className="flex-1">
                            <span className="font-bold text-sm block uppercase tracking-wider text-brand-offwhite">Cash on Delivery (COD)</span>
                            <span className="text-xs text-zinc-500 mt-1 block">
                              Pay in cash upon delivery. Adds an extra COD convenience charge of ₹{(storeConfig.codFee / 100).toFixed(0)}.
                            </span>
                          </div>
                        </label>
                      </div>
                    )}

                      {paymentMethod === 'cod' && (
                        <div className="mt-4 p-4 border border-zinc-800 bg-zinc-950/80 rounded space-y-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={`w-4 h-4 ${verifiedPhone ? 'text-green-500' : 'text-zinc-500'}`} />
                            <span className="text-xs font-bold uppercase tracking-wider text-brand-offwhite">
                              COD Security Verification
                            </span>
                          </div>
                          
                          {verifiedPhone ? (
                            <div className="text-xs text-zinc-400 space-y-1">
                              <p className="flex items-center gap-1.5 text-green-400 font-bold uppercase tracking-wider text-[10px]">
                                <CheckCircle className="w-3.5 h-3.5" /> Mobile Verified
                              </p>
                              <p className="font-mono text-zinc-300">{verifiedPhone}</p>
                              {(!user || user.authProvider === 'google') && (
                                <button 
                                  type="button" 
                                  onClick={() => { setVerifiedPhone(null); setVerifiedPhoneToken(null); }}
                                  className="text-[10px] text-zinc-500 underline uppercase tracking-wider hover:text-white mt-1"
                                >
                                  Change Number
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider">
                                To prevent spam orders, Cash on Delivery checkouts require mobile OTP verification.
                              </p>
                              <button
                                type="button"
                                onClick={startPhoneVerification}
                                disabled={isVerifyingPhone}
                                className="w-full bg-zinc-900 border border-zinc-800 text-white py-2.5 font-bold uppercase tracking-wider text-[10px] hover:bg-white hover:text-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {isVerifyingPhone ? 'Verifying OTP...' : 'Verify Mobile via OTP'}
                              </button>

                              {/* Dev Mock Verify Button */}
                              {process.env.NODE_ENV === 'development' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVerifiedPhone('+919999999999');
                                    setVerifiedPhoneToken('mock_token_9999999999');
                                    addToast('Mock verification successful (+91 99999 99999)', 'success');
                                  }}
                                  className="w-full text-zinc-500 border border-zinc-900 border-dashed py-1.5 font-bold uppercase tracking-wider text-[9px] hover:border-zinc-700 hover:text-zinc-350 transition-colors mt-2"
                                >
                                  [Dev Only] Quick Verify Mock Phone
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                ) : (
                  <div className="bg-zinc-900/40 border border-zinc-800 p-8 text-center space-y-4">
                    <Lock className="w-8 h-8 text-zinc-600 mx-auto" />
                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-wider text-brand-offwhite mb-2">Prepaid Gateway Coming Soon</h3>
                      <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                        Online payments are currently offline. You can place your order now, and we will contact you on WhatsApp to complete payment/shipping.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* Place Order / Payment Execute */}
              <div className="pt-4 space-y-4">
                {shippingProvider === 'express' && (
                  <div className="p-4 border border-zinc-800 bg-red-950/10 rounded-lg text-left text-xs text-red-400 leading-relaxed font-mono">
                    ⚠️ <strong>Express Returns Policy:</strong> Express orders are dispatched immediately via Borzo and cannot be cancelled/edited. Returns only apply to unworn streetwear items in original tag packaging.
                  </div>
                )}
                <button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || (paymentMethod === 'cod' && storeConfig.razorpayActive && !verifiedPhone)}
                  className="w-full bg-white text-black py-4 font-bold uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    'Processing Secure Checkout...'
                  ) : (paymentMethod === 'cod' && storeConfig.razorpayActive && !verifiedPhone) ? (
                    'Verify Phone to Continue'
                  ) : paymentMethod === 'razorpay' && storeConfig.razorpayActive ? (
                    `Pay ₹${(total / 100).toFixed(2)}`
                  ) : paymentMethod === 'cod' && storeConfig.razorpayActive ? (
                    'Pay ₹200 Deposit & Confirm Order'
                  ) : (
                    'Place WhatsApp Order'
                  )}
                  {!isProcessing && <Lock className="w-4 h-4" />}
                </button>

                {/* Trust Badge Strip */}
                <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-zinc-500 font-mono tracking-wider">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-zinc-650" /> SSL SECURED
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-zinc-650" /> SECURE CHECKOUT
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3 text-zinc-650" /> 3-DAY RETURNS
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Order Summary Sidebar */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-24">
          <div className="bg-zinc-900/20 border border-zinc-800 p-6 md:p-8">
            <h2 className="text-sm font-bold text-brand-offwhite mb-6 uppercase tracking-widest border-b border-zinc-800 pb-3">Items Summary</h2>
            
            <div className="space-y-4 mb-6 max-h-[35vh] overflow-y-auto custom-scrollbar pr-2">
              {items.map((item) => (
                <div key={`${item.id}-${item.size}`} className="flex gap-4">
                  <div className="w-16 h-20 bg-zinc-900 flex-shrink-0 relative border border-zinc-800">
                    <img
                      src={getOptimizedImageUrl(item.image, 200)}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute -top-2 -right-2 bg-zinc-800 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-zinc-700">
                      {item.quantity}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-brand-offwhite truncate uppercase tracking-wide">{item.name}</h4>
                    <p className="text-[10px] text-zinc-500 mt-1">SIZE: {item.size}</p>
                    <p className="text-xs text-zinc-400 font-mono mt-1">₹{(item.price / 100).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            <CheckoutCoupon subtotal={subtotal} />

            <div className="border-t border-zinc-800 pt-6 space-y-3 text-xs uppercase tracking-wider">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span className="font-mono text-zinc-400">₹{(subtotal / 100).toFixed(2)}</span>
              </div>
              
              {discount > 0 && (
                <div className="flex justify-between text-green-500">
                  <span>Discount ({discountCode?.code})</span>
                  <span className="font-mono">-₹{(discount / 100).toFixed(2)}</span>
                </div>
              )}
              
              <div className="flex justify-between text-zinc-500">
                <span>Shipping</span>
                <span className="font-mono font-extrabold text-emerald-400">
                  {shippingCharge === 0 ? 'FREE' : `₹${(shippingCharge / 100).toFixed(2)}`}
                </span>
              </div>
              
              <div className="pt-4 border-t border-zinc-850 flex justify-between items-center mt-3">
                <span className="text-brand-offwhite font-bold text-sm tracking-widest">Total</span>
                <span className="text-brand-offwhite font-bold text-lg font-mono">₹{(total / 100).toFixed(2)}</span>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  );
}
