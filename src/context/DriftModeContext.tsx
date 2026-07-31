'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

interface DriftModeContextType {
  isActive: boolean;
  discountPercent: number;
  userCode: string | null;
  codeUsed: boolean;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
  fetchOrCreateUserCode: () => Promise<string | null>;
}

const DriftModeContext = createContext<DriftModeContextType>({
  isActive: true,
  discountPercent: 20,
  userCode: null,
  codeUsed: false,
  isLoading: true,
  refreshStatus: async () => {},
  fetchOrCreateUserCode: async () => null,
});

export const DriftModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState<boolean>(true);
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [codeUsed, setCodeUsed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { isSignedIn } = useAuth();

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/drift-mode/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIsActive(!!data.is_active);
        setDiscountPercent(data.discount_percent || 20);
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

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

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
        isLoading,
        refreshStatus,
        fetchOrCreateUserCode,
      }}
    >
      {children}
    </DriftModeContext.Provider>
  );
};

export const useDriftMode = () => useContext(DriftModeContext);
