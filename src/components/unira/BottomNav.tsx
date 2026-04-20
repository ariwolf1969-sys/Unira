'use client';

import { useAppStore } from '@/lib/store';
import { House, Navigation, Users, Clock, User } from 'lucide-react';

const navItems = [
  { id: 'home', label: 'Inicio', icon: House, screen: 'home' },
  { id: 'ride', label: 'Pedir', icon: Navigation, screen: 'ride' },
  { id: 'communities', label: 'Comunidades', icon: Users, screen: 'communities' },
  { id: 'history', label: 'Actividad', icon: Clock, screen: 'history' },
  { id: 'profile', label: 'Cuenta', icon: User, screen: 'profile' },
];

const screensWithNav = new Set([
  'home', 'ride', 'food', 'send', 'history', 'profile', 'wallet', 'notifications',
  'chat', 'admin', 'food-restaurant', 'driver', 'communities',
]);

export function BottomNav() {
  const { currentScreen, navigateTo, notifications, cart } = useAppStore();

  if (!screensWithNav.has(currentScreen)) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/95 backdrop-blur-md border-t border-gray-100 safe-bottom z-50">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.screen;

          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.screen)}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-[#0EA5A0]' : 'text-[#9CA3AF]'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {/* Cart badge on food/compass icon */}
                {item.id === 'food' && cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
                {/* Unread notifications badge on activity */}
                {item.id === 'history' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-[#0EA5A0]' : 'text-[#9CA3AF]'
                }`}
              >
                {item.label}
              </span>
              {/* Active indicator */}
              {isActive && (
                <div className="absolute -bottom-0 w-8 h-0.5 rounded-full bg-[#0EA5A0]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
