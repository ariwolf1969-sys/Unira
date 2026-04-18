'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/lib/store';
import { ArrowLeft, Car, Gift, CreditCard, Settings, Bell, Trash2 } from 'lucide-react';

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

// ─── Type Config ─────────────────────────────────────────────────────────────

type NotifType = Notification['type'];

interface TypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  label: string;
}

const typeConfig: Record<NotifType, TypeConfig> = {
  trip: { icon: Car, color: 'text-[#0EA5A0]', bgColor: 'bg-[#0EA5A0]/10', label: 'Viajes' },
  promo: { icon: Gift, color: 'text-orange-500', bgColor: 'bg-orange-500/10', label: 'Promos' },
  payment: { icon: CreditCard, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', label: 'Pagos' },
  system: { icon: Settings, color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'Sistema' },
};

// ─── Filter Tabs ─────────────────────────────────────────────────────────────

interface FilterTab {
  key: string;
  label: string;
}

const filterTabs: FilterTab[] = [
  { key: 'all', label: 'Todas' },
  { key: 'trip', label: 'Viajes' },
  { key: 'promo', label: 'Promos' },
  { key: 'payment', label: 'Pagos' },
  { key: 'system', label: 'Sistema' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationsScreen() {
  const {
    notifications,
    markAsRead,
    goBack,
    showToast,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<string>('all');
  const [cleared, setCleared] = useState(false);

  const filteredNotifications = useMemo(() => {
    if (cleared) return [];
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab, cleared]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleMarkAllRead = () => {
    notifications.forEach((n) => {
      if (!n.read) markAsRead(n.id);
    });
    showToast('Todas las notificaciones marcadas como leídas', 'success');
  };

  const handleClearAll = () => {
    setCleared(true);
    showToast('Notificaciones borradas', 'info');
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markAsRead(notif.id);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white px-4 pt-12 pb-4 shadow-[0_1px_8px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Notificaciones</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {unreadCount} sin leer
                </p>
              )}
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-[#0EA5A0] hover:underline"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>
      </motion.div>

      {/* ── Filter Tabs ───────────────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        custom={1}
        className="bg-white mt-2 px-4 py-3"
      >
        <div className="flex gap-2 overflow-x-auto hide-scrollbar">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                activeTab === tab.key
                  ? 'bg-[#0EA5A0] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Notification List ─────────────────────────────────────────────── */}
      <div className="px-4 mt-2 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Sin notificaciones
              </h3>
              <p className="text-sm text-gray-500 max-w-[220px]">
                {activeTab === 'all'
                  ? 'Acá van a aparecer las alertas de viajes, promos y más'
                  : `No tenés notificaciones de tipo "${filterTabs.find((t) => t.key === activeTab)?.label}"`}
              </p>
            </motion.div>
          ) : (
            filteredNotifications.map((notif, idx) => {
              const config = typeConfig[notif.type];
              const Icon = config.icon;
              return (
                <motion.button
                  key={notif.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full flex items-start gap-3.5 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all text-left relative ${
                    !notif.read ? 'ring-1 ring-[#0EA5A0]/15' : ''
                  }`}
                >
                  {/* Unread dot */}
                  {!notif.read && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#0EA5A0]" />
                  )}

                  {/* Type icon */}
                  <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0 ml-1`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm ${notif.read ? 'font-medium text-gray-700' : 'font-bold text-gray-900'} truncate`}>
                        {notif.title}
                      </h3>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                        {timeAgo(notif.date)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {notif.body}
                    </p>
                    <span className={`inline-block text-[10px] font-medium mt-2 px-2 py-0.5 rounded-md ${config.bgColor} ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* ── Clear All Button ──────────────────────────────────────────────── */}
      {!cleared && filteredNotifications.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="px-4 mt-4"
        >
          <button
            onClick={handleClearAll}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white text-red-500 text-sm font-semibold hover:bg-red-50 active:scale-[0.99] transition-all shadow-sm border border-red-100"
          >
            <Trash2 className="w-4 h-4" />
            Borrar todo
          </button>
        </motion.div>
      )}
    </div>
  );
}
