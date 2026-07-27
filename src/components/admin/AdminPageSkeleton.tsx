'use client';

import React from 'react';

export default function AdminPageSkeleton({ title = 'Loading...' }: { title?: string }) {
  return (
    <div className="relative min-h-[60vh] w-full flex flex-col gap-6 animate-fade-in select-none">
      {/* Top Rail Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 z-[99999] animate-pulse" />

      {/* Page Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-6">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-zinc-200/80 rounded-md animate-pulse" />
          <div className="h-4 w-72 bg-zinc-200/50 rounded-md animate-pulse" />
        </div>
        <div className="h-10 w-36 bg-zinc-200/80 rounded-md animate-pulse" />
      </div>

      {/* Control Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border border-zinc-200/80 shadow-sm">
        <div className="h-10 w-full sm:w-80 bg-zinc-200/60 rounded-md animate-pulse" />
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="h-10 w-28 bg-zinc-200/60 rounded-md animate-pulse" />
          <div className="h-10 w-28 bg-zinc-200/60 rounded-md animate-pulse" />
        </div>
      </div>

      {/* Table / Grid Skeleton */}
      <div className="bg-white rounded-lg border border-zinc-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="h-5 w-32 bg-zinc-200/80 rounded animate-pulse" />
          <div className="h-5 w-20 bg-zinc-200/60 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-zinc-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded bg-zinc-200/70 animate-pulse flex-shrink-0" />
                <div className="space-y-2 flex-1 max-w-sm">
                  <div className="h-4 w-3/4 bg-zinc-200/80 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-zinc-200/50 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-4 w-20 bg-zinc-200/60 rounded animate-pulse hidden sm:block" />
              <div className="h-6 w-16 bg-zinc-200/60 rounded-full animate-pulse" />
              <div className="h-8 w-20 bg-zinc-200/70 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
