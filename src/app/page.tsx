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
import { X, CheckCircle, AlertCircle, Info, Loader2 } from 'lucide-react';
import { SosButton } from '@/components/unira/SosButton';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Code splitting: heavy screens loaded on demand
import dynamic from 'next/dynamic';

const FoodScreen = dynamic(() => import('@/components/unira/FoodScreen').then(m => ({ default: m.FoodScreen })), { loading: () => <ScreenLoader /> });
const SendScreen = dynamic(() => import('@/components/unira/SendScreen').then(m => ({ default: m.SendScreen })), { loading: () => <ScreenLoader /> });
const WalletScreen = dynamic(() => import('@/components/unira/WalletScreen').then(m => ({ default: m.WalletScreen })), { loading: () => <ScreenLoader /> });
const HistoryScreen = dynamic(() => import('@/components/unira/HistoryScreen').then(m => ({ default: m.HistoryScreen })), { loading: () => <ScreenLoader /> });
const ProfileScreen = dynamic(() => import('@/components/unira/ProfileScreen').then(m => ({ default: m.ProfileScreen })), { loading: () => <ScreenLoader /> });
const ChatScreen = dynamic(() => import('@/components/unira/ChatScreen').then(m => ({ default: m.ChatScreen })), { loading: () => <ScreenLoader /> });
const NotificationsScreen = dynamic(() => import('@/components/unira/NotificationsScreen').then(m => ({ default: m.NotificationsScreen })), { loading: () => <ScreenLoader /> });
const AdminScreen = dynamic(() => import('@/components/unira/AdminScreen').then(m => ({ default: m.AdminScreen })), { loading: () => <ScreenLoader /> });
const DriverScreen = dynamic(() => import('@/components/unira/DriverScreen').then(m => ({ default: m.DriverScreen })), { loading: () => <ScreenLoader /> });
const CommunitiesScreen = dynamic(() => import('@/components/unira/CommunitiesScreen').then(m => ({ default: m.CommunitiesScreen })), { loading: () => <ScreenLoader /> });
const ReferralScreen = dynamic(() => import('@/components/unira/ReferralScreen').then(m => ({ default: m.ReferralScreen })), { loading: () => <ScreenLoader /> });
const ServicesScreen = dynamic(() => import('@/components/unira/ServicesScreen').then(m => ({ default: m.ServicesScreen })), { loading: () => <ScreenLoader /> });
const VerifyScreen = dynamic(() => import('@/components/unira/VerifyScreen').then(m => ({ default: m.VerifyScreen })), { loading: () => <ScreenLoader /> });
const TripDetailScreen = dynamic(() => import('@/components/unira/TripDetailScreen').then(m => ({ default: m.TripDetailScreen })), { loading: () => <ScreenLoader /> });
const LostItemsScreen = dynamic(() => import('@/components/unira/LostItemsScreen').then(m => ({ default: m.LostItemsScreen })), { loading: () => <ScreenLoader /> });
const HelpScreen = dynamic(() => import('@/components/unira/HelpScreen').then(m => ({ default: m.HelpScreen })), { loading: () => <ScreenLoader /> });
const PermissionsOnboardingScreen = dynamic(() => import('@/components/unira/PermissionsOnboardingScreen').then(m => ({ default: m.PermissionsOnboardingScreen })), { loading: () => <ScreenLoader /> });
const DriverConfigScreen = dynamic(() => import('@/components/unira/DriverConfigScreen').then(m => ({ default: m.DriverConfigScreen })), { loading: () => <ScreenLoader /> });
const MyReviewsScreen = dynamic(() => import('@/components/unira/MyReviewsScreen').then(m => ({ default: m.MyReviewsScreen })), { loading: () => <ScreenLoader /> });
const DriverSimulatorScreen = dynamic(() => import('@/components/unira/DriverSimulatorScreen').then(m => ({ default: m.DriverSimulatorScreen })), { loading: () => <ScreenLoader /> });
const TermsScreen = dynamic(() => import('@/components/unira/TermsScreen').then(m => ({ default: m.TermsScreen })), { loading: () => <ScreenLoader /> });
const PaymentMethodsScreen = dynamic(() => import('@/components/unira/PaymentMethodsScreen').then(m => ({ default: m.PaymentMethodsScreen })), { loading: () => <ScreenLoader /> });
const SettingsScreen = dynamic(() => import('@/components/unira/SettingsScreen').then(m => ({ default: m.SettingsScreen })), { loading: () => <ScreenLoader /> });
const QueueScreen = dynamic(() => import('@/components/unira/QueueScreen').then(m => ({ default: m.QueueScreen })), { loading: () => <ScreenLoader /> });
const OperationsCenterScreen = dynamic(
  () => import('@/components/unira/OperationsCenterScreen').then(m => ({ default: m.OperationsCenterScreen })),
  { ssr: false, loading: () => <ScreenLoader /> }
);

// Shared loading spinner for code-split screens
function ScreenLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50dvh]">
      <Loader2 className="w-6 h-6 text-[#0EA5A0] animate-spin" />
    </div>
  );
}

export default function HomePage() {
  const { currentScreen, user, isHydrated, isLocked, toastMessage, toastType, showToast, setCurrentScreen, pinHash, setIsLocked, currentTrip, tripHistory, syncProfileFromServer } = useAppStore();

  const emptySubscribe = () => () => {};
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // ─── Sync isAdmin + role from server on hydration ──────────────────
  // Ensures the admin button shows even if localStorage had a stale value.
  // Also refreshes verification status, driver approval, etc.
  useEffect(() => {
    if (!isHydrated || !user || user.uid === 'demo') return;
    // Fire-and-forget profile sync (lightweight GET /api/users/me)
    void syncProfileFromServer(user.uid);
  }, [isHydrated, user?.uid, syncProfileFromServer]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      showToast('', 'info');
    }, 3000);
    return () => clearTimeout(timer);
  }, [toastMessage, showToast]);

  // Auto-navigate: if user exists after hydration, route based on verification status
  useEffect(() => {
    if (!isHydrated) return;
    if (user && (currentScreen === 'auth' || currentScreen === 'splash' || currentScreen === 'setup')) {
      // If phone not verified → go to verify screen
      // Demo user (uid === 'demo') is pre-verified, skip
      if (!user.phoneVerifiedAt && user.uid !== 'demo') {
        setCurrentScreen('verify');
      } else if (!user.termsAcceptedAt && user.uid !== 'demo') {
        // Terms & Conditions acceptance required before using the app
        setCurrentScreen('terms');
      } else if (!user.permissionsOnboardedAt && user.uid !== 'demo') {
        // Permissions onboarding required (Grupo F) — first login post-verification
        setCurrentScreen('permissions-onboarding');
      } else {
        setCurrentScreen('home');
      }
    } else if (!user && currentScreen !== 'auth') {
      setCurrentScreen('auth');
    }
  }, [isHydrated, user, currentScreen, setCurrentScreen]);

  // ─── Security: auto-lock when app goes to background ─────────────────────
  // Triggers when user switches apps, minimizes browser, or locks phone.
  // Prevents shoulder-surfing / casual access if user leaves phone unlocked.
  useEffect(() => {
    if (!isHydrated || !user || !pinHash) return;

    let lastHiddenAt: number | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now();
      } else if (document.visibilityState === 'visible' && lastHiddenAt !== null) {
        // Only re-lock if app was hidden for more than 2 seconds
        // (avoids re-locking on tab switches within the same browser session)
        const hiddenFor = Date.now() - lastHiddenAt;
        if (hiddenFor > 2000 && !isLocked) {
          setIsLocked(true);
        }
        lastHiddenAt = null;
      }
    };

    // Also re-lock on pagehide (iOS Safari backgrounding)
    const handlePageHide = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page was bfcached - will be restored; lock for security
        if (!isLocked) setIsLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide as EventListener);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide as EventListener);
    };
  }, [isHydrated, user, pinHash, isLocked, setIsLocked]);

  // ─── Push Notifications ──────────────────────────────────────────────
  const { cleanupToken: cleanupPushToken, tokenRegistered } = usePushNotifications();

  // Cleanup push token when user logs out
  useEffect(() => {
    if (isHydrated && !user && tokenRegistered) {
      void cleanupPushToken();
    }
  }, [isHydrated, user, cleanupPushToken]);

  // ─── PWA shortcut support: ?screen=ride jumps straight to ride screen ────
  useEffect(() => {
    if (!isHydrated || !user) return;
    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    if (screen && ['ride', 'food', 'send', 'wallet', 'history', 'profile'].includes(screen)) {
      setCurrentScreen(screen);
      // Clean URL so refresh doesn't keep jumping to that screen
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [isHydrated, user, setCurrentScreen]);

  // ─── PWA install prompt capture (for "Instalar app" button) ──────────────
  useEffect(() => {
    if (!isHydrated) return;
    const handler = (e: Event) => {
      e.preventDefault();
      // Store the event for later use (when user taps "Instalar")
      window.__uniraInstallPrompt = e as BeforeInstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isHydrated]);

  // ─── Email verification callback (?email-status=verified | ?email-error=...) ──
  useEffect(() => {
    if (!isHydrated || !user) return;
    const params = new URLSearchParams(window.location.search);
    const emailStatus = params.get('email-status');
    const emailError = params.get('email-error');
    if (emailStatus === 'verified') {
      // Update local user state
      useAppStore.setState({
        user: user ? { ...user, emailVerifiedAt: new Date().toISOString() } : user,
      });
      showToast('¡Email verificado correctamente!', 'success');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (emailStatus === 'already-verified') {
      showToast('Tu email ya estaba verificado.', 'info');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (emailError) {
      const messages: Record<string, string> = {
        'missing-token': 'Falta el token de verificación.',
        'invalid-token': 'El token de verificación no es válido.',
        'expired': 'El enlace expiró. Solicitá uno nuevo desde la app.',
        'server': 'Error del servidor. Reintentá más tarde.',
      };
      showToast(messages[emailError] || 'Error al verificar email.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isHydrated, user, showToast]);

  const renderScreen = useCallback(() => {
    switch (currentScreen) {
      case 'splash':
        return <SplashScreen />;
      case 'auth':
        return <AuthScreen />;
      case 'verify':
        return <VerifyScreen />;
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
      case 'trip-detail': return <TripDetailScreen />;
      case 'lost-items': return <LostItemsScreen />;
      case 'help': return <HelpScreen />;
      case 'permissions-onboarding': return <PermissionsOnboardingScreen />;
      case 'driver-config': return <DriverConfigScreen />;
      case 'my-reviews': return <MyReviewsScreen />;
      case 'driver-simulator': return <DriverSimulatorScreen />;
      case 'terms': return <TermsScreen />;
      case 'payment-methods': return <PaymentMethodsScreen />;
      case 'settings': return <SettingsScreen />;
      case 'queue': return <QueueScreen />;
      case 'operations-center': return <OperationsCenterScreen />;
      default:
        return null;
    }
  }, [currentScreen]);

  // Determine if this screen should have dark auth-style background
  const isDarkScreen = ['splash', 'auth', 'verify', 'role'].includes(currentScreen);

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
    <div suppressHydrationWarning className={`${currentScreen === 'operations-center' ? 'h-screen w-screen' : 'mobile-app'} relative ${isDarkScreen ? '' : ''}`}>
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

      {/* Bottom navigation - hidden in operations-center */}
      {currentScreen !== 'operations-center' && <BottomNav />}

      {/* SOS button — replaces old emergency button.
          Small red circle with "SOS" white text + 3s countdown before calling 911.
          Passes active trip id (if any) so the cooperativa can see live driver location. */}
      {user && !['splash', 'auth', 'role', 'verify', 'permissions-onboarding', 'operations-center'].includes(currentScreen) && (
        <SosButton
          activeTripId={currentTrip?.id || tripHistory.find(t => t.status === 'in_progress')?.id || null}
          activeTripToken={null}
        />
      )}
    </div>
  );
}
