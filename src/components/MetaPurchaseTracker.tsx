'use client';

import { useEffect } from 'react';
import { trackPurchase } from '@/lib/meta-pixel';

interface MetaPurchaseTrackerProps {
  orderId: string;
  contentIds: string[];
  totalValue: number; // in INR / rupees
  currency?: string;
}

export function MetaPurchaseTracker({
  orderId,
  contentIds,
  totalValue,
  currency = 'INR',
}: MetaPurchaseTrackerProps) {
  useEffect(() => {
    trackPurchase({
      orderId,
      contentIds,
      totalValue,
      currency,
    });
  }, [orderId, contentIds, totalValue, currency]);

  return null;
}

export default MetaPurchaseTracker;
