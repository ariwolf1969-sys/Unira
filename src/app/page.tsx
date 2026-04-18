'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/store';
import { SplashScreen } from '@/components/unira/SplashScreen';
import { SetupScreen } from '@/components/unira/SetupScreen';
import { AuthScreen } from '@/components/unira/AuthScreen';
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

// Placeholder screens for future development
function PlaceholderScreen({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6 pt-4 pb-24 bg-[#F5F7FA]">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#0EA5A0]/10 flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { currentScreen, user, isFirebaseReady, toastMessage, toastType, showToast } = useAppStore();

  const emptySubscribe = () => () => {};
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Check localStorage for firebase config on mount
  useEffect(() => {
    if (mounted) {
      const storedConfig = localStorage.getItem('unira_firebase_config');
      if (storedConfig) {
        useAppStore.getState().setIsFirebaseReady(true);
      }
    }
  }, [mounted]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      showToast('', 'info');
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastMessage, showToast]);

  const renderScreen = useCallback(() => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen />;
      case 'setup':
        return <SetupScreen />;
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
        return (
          <PlaceholderScreen
            title="Modo Conductor"
            description="Próximamente: panel de conductor, solicitudes, navegación"
            icon={<svg className="w-10 h-10 text-[#0EA5A0]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>}
          />
        );
      case 'chat':
        return <ChatScreen />;
      case 'admin':
        return <AdminScreen />;
      case 'food-restaurant':
        return <FoodScreen />;
      default:
        return (
          <PlaceholderScreen
            title="Pantalla no encontrada"
            description={`La pantalla "${currentScreen}" aún no está disponible.`}
            icon={<Info className="w-10 h-10 text-gray-400" />}
          />
        );
    }
  }, [currentScreen]);

  // Determine if this screen should have dark auth-style background
  const isDarkScreen = ['splash', 'setup', 'auth', 'role'].includes(currentScreen);

  // Auto-start at splash if we're on home but there's no user
  useEffect(() => {
    if (mounted && !user && currentScreen === 'home') {
      useAppStore.getState().setCurrentScreen('splash');
    }
  }, [mounted, user, currentScreen]);

  if (!mounted) return null;

  const toastIcon = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-sky-400" />,
  };

  return (
    <div className={`mobile-app relative ${isDarkScreen ? '' : ''}`}>
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
      {user && !['splash', 'setup', 'auth', 'role'].includes(currentScreen) && (
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
