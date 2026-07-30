'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastContainer';
import { Loader2, AlertCircle, Clock } from 'lucide-react';

interface CancelOrderButtonProps {
  orderId: string;
  cancelAllowedUntil?: string | Date | null;
  orderStatus: string;
  onCancelled?: () => void;
}

export default function CancelOrderButton({
  orderId,
  cancelAllowedUntil,
  orderStatus,
  onCancelled,
}: CancelOrderButtonProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState<number | null>(null);
  const [isCancelled, setIsCancelled] = useState(orderStatus === 'CANCELLED' || orderStatus === 'cancelled');

  useEffect(() => {
    if (!cancelAllowedUntil) {
      setTimeLeftSec(0);
      return;
    }

    const targetTime = new Date(cancelAllowedUntil).getTime();

    const updateTimer = () => {
      const diff = Math.floor((targetTime - Date.now()) / 1000);
      if (diff <= 0) {
        setTimeLeftSec(0);
      } else {
        setTimeLeftSec(diff);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [cancelAllowedUntil]);

  const cancellableStatuses = ['CREATED', 'PAYMENT_PENDING', 'PAID', 'CANCELLATION_WINDOW', 'placed', 'confirmed', 'preparing'];
  const isStatusCancellable = cancellableStatuses.includes(orderStatus) && !isCancelled;
  const isTimeValid = timeLeftSec !== null && timeLeftSec > 0;
  const canCancel = isStatusCancellable && isTimeValid;

  const handleCancel = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel this order? Items will be returned to inventory.'
      )
    ) {
      return;
    }

    try {
      setIsPending(true);
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel order');
      }

      setIsCancelled(true);
      addToast('Order cancelled successfully', 'success');
      if (onCancelled) {
        onCancelled();
      } else {
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Failed to cancel order', 'error');
    } finally {
      setIsPending(false);
    }
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (isCancelled) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-4 py-2.5 rounded-lg text-xs font-mono flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span>This order has been cancelled.</span>
      </div>
    );
  }

  if (canCancel) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1.5 text-amber-400 font-mono text-xs bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          <span>You can cancel this order for the next {formatCountdown(timeLeftSec!)}</span>
        </div>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 disabled:opacity-40 px-4 py-2 font-mono uppercase tracking-widest text-xs transition-all flex items-center gap-2 rounded-lg cursor-pointer"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isPending ? 'Cancelling...' : 'Cancel Order'}
        </button>
      </div>
    );
  }

  // Once cancel_allowed_until has passed or order is being prepared for shipping
  return (
    <div className="text-[11px] text-zinc-400 font-mono bg-zinc-950 border border-zinc-850 p-3 rounded-lg max-w-md">
      This order is being prepared for shipment and can no longer be cancelled here. Contact support for help.
    </div>
  );
}
