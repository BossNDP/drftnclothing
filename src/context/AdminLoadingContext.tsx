'use client';

import React, { createContext, useContext, useState } from 'react';

interface AdminLoadingContextType {
  isGlobalLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
}

const AdminLoadingContext = createContext<AdminLoadingContextType>({
  isGlobalLoading: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export function AdminLoadingProvider({ children }: { children: React.ReactNode }) {
  const [manualLoadingCount, setManualLoadingCount] = useState(0);
  const startLoading = () => setManualLoadingCount((c) => c + 1);
  const stopLoading = () => setManualLoadingCount((c) => Math.max(0, c - 1));

  return (
    <AdminLoadingContext.Provider
      value={{
        isGlobalLoading: manualLoadingCount > 0,
        startLoading,
        stopLoading,
      }}
    >
      {children}
    </AdminLoadingContext.Provider>
  );
}

export const useAdminLoading = () => useContext(AdminLoadingContext);
