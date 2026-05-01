'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/store';
import { SplashScreen } from '@/components/unira/SplashScreen';
import { AuthScreen } from '@/components/unira/AuthScreen';
import { LockScreen } from '@/components/unira/LockScreen';
import { RoleScreen } from '@/components/unira/RoleScreen';
import { HomeScreen } from '@/components/unira/HomeScreen';
import { RideScreen } from '@/components/unira/RideScreen';
import { BottomNav } from '@/components/unira/BottomNav';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { FoodScreen } from '@/components/unira/FoodScreen';
import { SendScreen } from '@/components/unira/SendScreen';
import { WalletScreen } from '@/components/unira/WalletScreen';
import { HistoryScreen } from '@/components/unira/HistoryScreen';
import { ProfileScreen } from '@/components/unira/ProfileScreen';
import { ChatScreen } from '@/components/unira/ChatScreen';
import { NotificationsScreen } from '@/components/unira/NotificationsScreen';
import { AdminScreen } from '@/components/unira/AdminScreen';
import { DriverScreen } from '@/components/unira/DriverScreen';
import { CommunitiesScreen } from '@/components/unira/CommunitiesScreen';
import { ReferralScreen } from '@/components/unira/ReferralScreen';
import { ServicesScreen } from '@/components/unira/ServicesScreen';

export default function HomePage() {
  const { currentScreen, user, isHydrated, isLocked, toastMessage, toastType, showToast, setCurrentScreen } = useAppStore();

  const emptySubscribe = () => () => {};
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      showToast('', 'info');
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastMessage, showToast]);

  // Auto-navigate: if user exists after hydration, go to home; if not, go to auth
  useEffect(() => {
    if (!isHydrated) return;
    if (user && (currentScreen === 'auth' || currentScreen === 'splash' || currentScreen === 'setup')) {
      setCurrentScreen('home');
    } else if (!user && currentScreen !== 'auth') {
      setCurrentScreen('auth');
    }
  }, [isHydrated, user, currentScreen, setCurrentScreen]);

  const renderScreen = useCallback(() => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen />;
      case 'auth':
        return <AuthScreen />;
      case 'role':
        return <RoleScreen />;
      case 'home':
        return <HomeScreen />;
      case 'ride':
        return <RideScreen />;
      case 'food':
        return <FoodScreen />;
      case 'send':
        return <SendScreen />;
      case 'history':
        return <HistoryScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'wallet':
        return <WalletScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'driver':
        return <DriverScreen />;
      case 'chat':
        return <ChatScreen />;
      case 'admin':
        return <AdminScreen />;
      case 'food-restaurant': return <FoodScreen />;
      case 'services': return <ServicesScreen />;
      case 'referral': return <ReferralScreen />;
      case 'communities': return <CommunitiesScreen />;
      default:
        return null;
    }
  }, [currentScreen]);

  // Determine if this screen should have dark auth-style background
  const isDarkScreen = ['splash', 'auth', 'role'].includes(currentScreen);

  // Wait for hydration to avoid flash of wrong screen
  if (!mounted || !isHydrated) return null;

  // Lock screen takes priority when user is logged in and locked
  if (isLocked && user) {
    return (
      <div suppressHydrationWarning className="mobile-app relative">
        <div className="screen-slide-in">
          <LockScreen />
        </div>
      </div>
    );
  }

  const toastIcon = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-sky-400" />,
  };

  return (
    <div suppressHydrationWarning className={`mobile-app relative ${isDarkScreen ? '' : ''}`}>
      {/* Toast notification overlay */}
      {toastMessage && (
        <div className="absolute top-4 left-4 right-4 z-[100] animate-[slideInUp_0.3s_ease-out]">
          <div className="bg-gray-900/95 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
            {toastIcon[toastType]}
            <p className="text-white text-sm font-medium flex-1">{toastMessage}</p>
            <button
              onClick={() => showToast('', 'info')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Screen content */}
      <div className="screen-slide-in">
        {renderScreen()}
      </div>

      {/* Bottom navigation */}
      <BottomNav />

      {/* Emergency stop button (always visible) */}
      {user && !['splash', 'auth', 'role'].includes(currentScreen) && (
        <div className="fixed bottom-20 right-4 z-40 max-w-[430px]">
          <button
            onClick={() => {
              showToast('Botón de emergencia presionado', 'error');
            }}
            className="w-14 h-14 rounded-full bg-red-500 shadow-lg shadow-red-500/30 flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all"
            aria-label="Botón de emergencia"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9V4M12 20V14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
