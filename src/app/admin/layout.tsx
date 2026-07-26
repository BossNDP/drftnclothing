'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, PackageSearch, Settings, LogOut, Tag, Menu, X, Bell, Users } from 'lucide-react';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Categories', href: '/admin/categories', icon: Tag },
  { label: 'Products', href: '/admin/products', icon: PackageSearch },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { label: 'Discounts', href: '/admin/discounts', icon: Tag },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (isLoaded && pathname !== '/admin/login') {
      if (!userId) {
        router.push('/admin/login');
      } else if (user) {
        const userEmail = user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress;
        const allowlist = ['admin@drftn.in', 'nagarjundp256@gmail.com', 'drftnclothing@gmail.com', 'chethansc47@gmail.com', 'nnvg2608@gmail.com'];
        const isEmailAllowed = userEmail && allowlist.includes(userEmail.toLowerCase());

        const role = user.publicMetadata?.role;
        const isAdmin = role === 'admin' || isEmailAllowed;
        const isIntern = role === 'intern';
        
        if (!isAdmin && !isIntern) {
          router.push('/admin/login?error=unauthorized');
        } else if (isIntern && pathname.startsWith('/admin/users')) {
          router.push('/admin?error=unauthorized');
        }
      }
    }
  }, [isLoaded, userId, user, pathname, router]);

  // Close mobile drawer when pathname changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await signOut();
    router.push('/admin/login');
  };

  if (!isLoaded && pathname !== '/admin/login') {
    return <div className="min-h-screen bg-[#F9F9F8] flex items-center justify-center text-zinc-500 font-medium">Loading Admin Panel...</div>;
  }

  // If we are on the login page, just render the children without the sidebar
  if (pathname === '/admin/login') {
    return <div className="min-h-screen bg-zinc-950">{children}</div>;
  }

  const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress;
  const allowlist = ['admin@drftn.in', 'nagarjundp256@gmail.com', 'drftnclothing@gmail.com', 'chethansc47@gmail.com', 'nnvg2608@gmail.com'];
  const isEmailAllowed = Boolean(userEmail && allowlist.includes(userEmail.toLowerCase()));

  // If user metadata is loaded and role is not admin or intern, don't render layout content while redirecting
  if (user && user.publicMetadata?.role !== 'admin' && user.publicMetadata?.role !== 'intern' && !isEmailAllowed) {
    return <div className="min-h-screen bg-[#F9F9F8] flex items-center justify-center text-brand-red font-bold">Redirecting...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9F9F8] flex flex-col md:flex-row text-zinc-900 font-sans">
      {/* Desktop Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-zinc-200/80 flex-shrink-0 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-center">
          <Link href="/" className="text-xl font-extrabold tracking-[0.2em] text-zinc-900">
            D R F T N <span className="text-brand-red font-light text-xs align-top font-mono">ADMIN</span>
          </Link>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2">
          {NAV_ITEMS.filter(item => !(item.href === '/admin/users' && user?.publicMetadata?.role === 'intern')).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded text-sm font-bold tracking-wider uppercase transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left rounded text-sm font-bold tracking-wider uppercase text-zinc-400 hover:bg-zinc-50 hover:text-brand-red transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 bg-white">
        <button onClick={() => setIsMobileOpen(true)} className="text-zinc-500 hover:text-zinc-900 p-2">
          <Menu className="w-6 h-6" />
        </button>
        <Link href="/" className="text-lg font-extrabold tracking-[0.2em] text-zinc-900">
          D R F T N <span className="text-brand-red font-light text-xs align-top font-mono">ADMIN</span>
        </Link>
        <button onClick={handleLogout} className="text-zinc-500 hover:text-brand-red p-2">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Slide-Over Drawer Menu */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop overlay */}
          <div 
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
          />

          {/* Drawer content box */}
          <aside className="relative w-64 max-w-[80vw] h-full bg-white border-r border-zinc-200 p-6 flex flex-col justify-between z-10 animate-slide-in-from-left">
            <div>
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-zinc-100 pb-5 mb-6">
                <span className="text-md font-black tracking-widest text-zinc-900 uppercase">
                  DRFTN <span className="text-brand-red text-[9px] align-top">MENU</span>
                </span>
                <button onClick={() => setIsMobileOpen(false)} className="text-zinc-400 hover:text-zinc-900 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer navigation list */}
              <nav className="space-y-1">
                {NAV_ITEMS.filter(item => !(item.href === '/admin/users' && user?.publicMetadata?.role === 'intern')).map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded text-xs font-bold tracking-widest uppercase transition-all ${
                        isActive
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Logout button at drawer footer */}
            <div className="border-t border-zinc-100 pt-5">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3.5 px-4 py-3 w-full text-left rounded text-xs font-bold tracking-widest uppercase text-zinc-400 hover:text-brand-red transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout Account
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F9F9F8] relative animate-fade-in">
        {children}
      </main>
    </div>
  );
}
