'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface DriftModeContextType {
  isActive: boolean;
  discountPercent: number;
  userCode: string | null;
  codeUsed: boolean;
  codeGenerated: boolean;
  popupShownCount: number;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
  fetchOrCreateUserCode: () => Promise<string | null>;
  trackPopupView: () => Promise<number>;
}

const DriftModeContext = createContext<DriftModeContextType>({
  isActive: true,
  discountPercent: 30,
  userCode: null,
  codeUsed: false,
  codeGenerated: false,
  popupShownCount: 0,
  isLoading: true,
  refreshStatus: async () => {},
  fetchOrCreateUserCode: async () => null,
  trackPopupView: async () => 0,
});

export const DriftModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState<boolean>(true);
  const [discountPercent, setDiscountPercent] = useState<number>(30);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [codeUsed, setCodeUsed] = useState<boolean>(false);
  const [codeGenerated, setCodeGenerated] = useState<boolean>(false);
  const [popupShownCount, setPopupShownCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { isSignedIn } = useAuth();

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/drift-mode/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIsActive(!!data.is_active);
        setDiscountPercent(data.discount_percent || 30);
        setPopupShownCount(data.popup_shown_count || 0);
        setCodeGenerated(!!data.code_generated);
        setCodeUsed(!!data.code_used);
      }
    } catch (err) {
      console.error('[DriftModeContext] Failed to fetch status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOrCreateUserCode = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/drift-mode/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setUserCode(data.code);
        setCodeUsed(false);
        setCodeGenerated(true);
        return data.code;
      } else if (data.error === 'already_used') {
        setCodeUsed(true);
        setUserCode(null);
        return null;
      }
    } catch (err) {
      console.error('[DriftModeContext] Failed to generate/fetch user code:', err);
    }
    return null;
  }, []);

  const trackPopupView = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch('/api/drift-mode/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.popup_shown_count === 'number') {
          setPopupShownCount(data.popup_shown_count);
          return data.popup_shown_count;
        }
      }
    } catch (err) {
      console.error('[DriftModeContext] Failed to track popup view:', err);
    }
    return popupShownCount + 1;
  }, [popupShownCount]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus, isSignedIn]);

  useEffect(() => {
    if (isActive && isSignedIn) {
      fetchOrCreateUserCode();
    }
  }, [isActive, isSignedIn, fetchOrCreateUserCode]);

  return (
    <DriftModeContext.Provider
      value={{
        isActive,
        discountPercent,
        userCode,
        codeUsed,
        codeGenerated,
        popupShownCount,
        isLoading,
        refreshStatus,
        fetchOrCreateUserCode,
        trackPopupView,
      }}
    >
      {children}
    </DriftModeContext.Provider>
  );
};

export const useDriftMode = () => useContext(DriftModeContext);
