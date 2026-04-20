'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { promotions, restaurants, places } from '@/lib/places';
import type { Restaurant } from '@/lib/store';
import {
  Search,
  Bell,
  Car,
  Bike,
  Utensils,
  Package,
  Wallet,
  MessageCircle,
  Headphones,
  Wrench,
  Shield,
  MapPin,
  Star,
  Gift,
  CalendarDays,
  Users,
  ChevronRight,
  Clock,
} from 'lucide-react';

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function getFirstName(name: string): string {
  return name.split(' ')[0];
}

const promoIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Gift,
  Utensils,
  CalendarDays,
  Users,
};

const restaurantGradients: Record<string, string> = {
  Empanadas: 'from-orange-400 to-amber-500',
  Parrilla: 'from-red-500 to-rose-600',
  Pizzas: 'from-yellow-400 to-orange-500',
  Sushi: 'from-pink-400 to-rose-400',
  Café: 'from-amber-600 to-yellow-700',
  Hamburguesas: 'from-red-400 to-orange-500',
  Milanesas: 'from-amber-500 to-yellow-600',
  Saludable: 'from-emerald-400 to-green-500',
};

// ─── Recent Places ───────────────────────────────────────────────────────────

const recentPlaceNames = ['Obelisco', 'Palermo Soho', 'Puerto Madero', 'Recoleta Cemetery'];

// ─── Quick Services ──────────────────────────────────────────────────────────

interface QuickService {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  action: string;
}

const quickServices: QuickService[] = [
  { id: 'ride', label: 'UniraRide', icon: Car, color: '#0EA5A0', action: 'ride' },
  { id: 'moto', label: 'UniraMoto', icon: Bike, color: '#F97316', action: 'ride-moto' },
  { id: 'food', label: 'UniraFood', icon: Utensils, color: '#EF4444', action: 'food' },
  { id: 'send', label: 'UniraEnvíos', icon: Package, color: '#3B82F6', action: 'send' },
  { id: 'services', label: 'UniraServicios', icon: Wrench, color: '#EC4899', action: 'services' },
  { id: 'wallet', label: 'UniraPay', icon: Wallet, color: '#22C55E', action: 'wallet' },
  { id: 'chat', label: 'UniraChat', icon: MessageCircle, color: '#8B5CF6', action: 'chat' },
  { id: 'help', label: 'UniraHelp', icon: Headphones,
  Wrench, color: '#6B7280', action: 'help' },
  { id: 'admin', label: 'UniraAdmin', icon: Shield, color: '#374151', action: 'admin' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function HomeScreen() {
  const {
    user,
    notifications,
    setCurrentScreen,
    setSelectedVehicle,
    setDestination,
    showToast,
  } = useAppStore();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const recentPlaces = useMemo(
    () => places.filter((p) => recentPlaceNames.includes(p.name)),
    []
  );

  const nearbyRestaurants = useMemo(() => restaurants.slice(0, 3), []);

  const firstName = user ? getFirstName(user.name) : 'Usuario';
  const isDemo = user?.email === 'demo@unira.app';
  const displayName = isDemo ? 'Usuario' : firstName;

  const handleServiceClick = (service: QuickService) => {
    switch (service.action) {
      case 'ride':
        setCurrentScreen('ride');
        break;
      case 'ride-moto':
        setSelectedVehicle('moto');
        setCurrentScreen('ride');
        break;
      case 'food':
        setCurrentScreen('food');
        break;
      case 'send':
        setCurrentScreen('send');
        break;
      case 'services':
        setCurrentScreen('services');
        break;
      case 'wallet':
        setCurrentScreen('wallet');
        break;
      case 'chat':
        setCurrentScreen('chat');
        break;
      case 'help':
        showToast('Centro de ayuda próximamente', 'info');
        break;
      case 'admin':
        setCurrentScreen('admin');
        break;
    }
  };

  const handlePlaceClick = (place: typeof places[0]) => {
    setDestination(place);
    setCurrentScreen('ride');
  };

  const handleRestaurantClick = (restaurant: Restaurant) => {
    setCurrentScreen('food-restaurant');
  };

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] pb-24">
      {/* ── Promo Banner ─── */}
    <motion.div
      initial={{ opacity:0, y:-20 }}
      animate={{ opacity:1, y:0 }}
      transition={{ duration:0.5, delay:0.3 }}
      className="mx-3 mt-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg">
      <div><p className="font-bold text-sm">Viaje gratis este finde!</p><p className="text-xs text-purple-200 mt-0.5">Usa el codigo UNIRAFINDE antes del domingo</p></div>
      <div className="text-center"><p className="text-2xl font-bold animate-pulse">48hs</p><p className="text-xs text-purple-200">restantes</p></div>
    </motion.div>

    {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-b-3xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] px-5 pt-12 pb-5"
      >
        {/* Top row: Greeting + Bell */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500 font-medium">
              {getGreeting()} 👋
            </p>
            <h1 className="text-xl font-bold text-gray-900 mt-0.5">
              {displayName}
            </h1>
          </div>

          <button
            onClick={() => setCurrentScreen('notifications')}
            className="relative w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Notificaciones"
          >
            <Bell className="w-5 h-5 text-gray-700" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <button
          onClick={() => setCurrentScreen('ride')}
          className="w-full flex items-center gap-3 bg-[#F5F7FA] rounded-2xl px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.99] transition-all"
        >
          <Search className="w-5 h-5 text-gray-400" strokeWidth={2} />
          <span className="text-gray-400 text-sm font-medium">¿A dónde vas?</span>
        </button>
      </motion.div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 space-y-6">
        {/* ── Promotional Banners ────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 snap-x snap-mandatory -mx-5 px-5">
            {promotions.map((promo) => {
              const Icon = promoIconMap[promo.icon] || Gift;
              return (
                <div
                  key={promo.id}
                  className="min-w-[280px] h-[130px] rounded-2xl p-5 relative overflow-hidden snap-start flex-shrink-0 shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${promo.color}, ${promo.color}dd)`,
                  }}
                >
                  {/* Background decorative icon */}
                  <div className="absolute -bottom-2 -right-2 opacity-15">
                    <Icon className="w-28 h-28 text-white" />
                  </div>

                  <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                      <h3 className="text-white font-bold text-[15px] leading-tight">
                        {promo.title}
                      </h3>
                      <p className="text-white/80 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                        {promo.description}
                      </p>
                    </div>
                    {promo.code && (
                      <span className="inline-flex self-start items-center mt-2 bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg">
                        {promo.code}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Quick Services Grid ────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          className="bg-white rounded-2xl p-5 shadow-sm"
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-4 gap-y-5 gap-x-2 max-h-[200px] overflow-y-auto scroll-smooth"
          >
            {quickServices.map((service) => {
              const Icon = service.icon;
              return (
                <motion.button
                  key={service.id}
                  variants={fadeUp}
                  onClick={() => handleServiceClick(service)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className="w-[56px] h-[56px] rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md group-active:scale-95 transition-all"
                    style={{ backgroundColor: service.color }}
                  >
                    <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 leading-tight">
                    {service.label}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </motion.div>

        {/* ── Recent Destinations ────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">
              Destinos frecuentes
            </h2>
            <button
              onClick={() => setCurrentScreen('history')}
              className="text-xs font-semibold text-[#0EA5A0] flex items-center gap-0.5 hover:underline"
            >
              Ver todos
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-2.5"
          >
            {recentPlaces.map((place, idx) => (
              <motion.button
                key={place.name}
                variants={fadeUp}
                custom={idx}
                onClick={() => handlePlaceClick(place)}
                className="w-full flex items-center gap-3.5 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-[#0EA5A0]/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-[#0EA5A0]" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {place.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {place.address}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        {/* ── Nearby Restaurants ─────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          className="pb-2"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">
              Restaurantes cerca tuyo
            </h2>
            <button
              onClick={() => setCurrentScreen('food')}
              className="text-xs font-semibold text-[#0EA5A0] flex items-center gap-0.5 hover:underline"
            >
              Ver todos
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 snap-x snap-mandatory -mx-5 px-5">
            {nearbyRestaurants.map((restaurant) => {
              const gradient =
                restaurantGradients[restaurant.category] ||
                'from-gray-400 to-gray-500';
              return (
                <motion.button
                  key={restaurant.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  onClick={() => handleRestaurantClick(restaurant)}
                  className="min-w-[200px] max-w-[200px] bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all snap-start flex-shrink-0"
                >
                  {/* Image placeholder */}
                  <div
                    className={`h-28 bg-gradient-to-br ${gradient} flex items-center justify-center relative`}
                  >
                    <span className="text-4xl font-extrabold text-white/80 tracking-tight">
                      {restaurant.name[0]}
                    </span>
                    {/* Delivery fee badge */}
                    <div className="absolute top-2.5 right-2.5 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-gray-800 px-2 py-0.5 rounded-lg">
                      Envío ${restaurant.deliveryFee}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3.5">
                    <p className="font-semibold text-sm text-gray-900 truncate leading-tight">
                      {restaurant.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-semibold text-gray-700">
                          {restaurant.rating}
                        </span>
                      </div>
                      <span className="text-gray-300 text-xs">•</span>
                      <div className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {restaurant.deliveryTime}
                        </span>
                      </div>
                    </div>
                    <span className="inline-block text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md mt-2">
                      {restaurant.category}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
