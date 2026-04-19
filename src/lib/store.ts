import { create } from 'zustand';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  email: string;
  name: string;
  phone: string;
  dni: string;
  avatar: string;
  role: 'passenger' | 'driver';
  isDriverApproved: boolean;
}

export interface Trip {
  id: string;
  type: 'ride' | 'food' | 'send';
  status: 'searching' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  origin: Place;
  destination: Place;
  fare: number;
  vehicleType?: string;
  driverId?: string;
  driverName?: string;
  driverPhoto?: string;
  driverVehicle?: string;
  rating?: number;
  distance?: number;
  duration?: number;
  createdAt: Date;
}

export interface Place {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface WalletMovement {
  id: string;
  type: 'topup' | 'ride' | 'food' | 'send' | 'tip' | 'cashback';
  amount: number;
  description: string;
  date: Date;
  balance: number;
}

export interface Restaurant {
  id: string;
  name: string;
  image: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  category: string;
  menu: MenuItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

export interface CartItem {
  menuItem: MenuItem;
  restaurantId: string;
  restaurantName: string;
  quantity: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'trip' | 'promo' | 'payment' | 'system';
  read: boolean;
  date: Date;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'quick';
}

// ─── Store Interface ─────────────────────────────────────────────────────────

interface AppStore {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;
  isFirebaseReady: boolean;
  setIsFirebaseReady: (v: boolean) => void;

  // Navigation
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
  previousScreen: string;
  navigateTo: (screen: string) => void;
  goBack: () => void;

  // Ride
  origin: Place | null;
  setOrigin: (p: Place | null) => void;
  destination: Place | null;
  setDestination: (p: Place | null) => void;
  selectedVehicle: string;
  setSelectedVehicle: (v: string) => void;
  currentTrip: Trip | null;
  setCurrentTrip: (t: Trip | null) => void;
  tripHistory: Trip[];
  addToHistory: (t: Trip) => void;
  tripVerificationCode: string | null;
  setTripVerificationCode: (code: string | null) => void;

  // Wallet
  walletBalance: number;
  setWalletBalance: (b: number) => void;
  walletMovements: WalletMovement[];
  addMovement: (m: WalletMovement) => void;

  // Food
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (menuItemId: string) => void;
  updateCartQuantity: (menuItemId: string, qty: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Notification) => void;
  markAsRead: (id: string) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;

  // Driver mode
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;

  // UI
  isLoading: boolean;
  setLoading: (v: boolean) => void;
  toastMessage: string;
  toastType: 'success' | 'error' | 'info';
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

// ─── Sample Data ─────────────────────────────────────────────────────────────

const now = new Date();
const sampleTripHistory: Trip[] = [
  {
    id: 'trip-001',
    type: 'ride',
    status: 'completed',
    origin: { name: 'Obelisco', address: 'Av. 9 de Julio, C1073 CABA', lat: -34.6037, lng: -58.3816 },
    destination: { name: 'Puerto Madero', address: 'Av. Alicia Moreau de Justo, C1107 CABA', lat: -34.6172, lng: -58.3639 },
    fare: 1850,
    vehicleType: 'auto',
    driverId: 'drv-101',
    driverName: 'Marcelo Gómez',
    driverPhoto: '',
    driverVehicle: 'Toyota Corolla - Negro',
    rating: 5,
    distance: 3.2,
    duration: 12,
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'trip-002',
    type: 'food',
    status: 'completed',
    origin: { name: 'Parrilla La Porteña', address: 'Av. Corrientes 4500, C1414 CABA', lat: -34.6030, lng: -58.4400 },
    destination: { name: 'Palermo Soho', address: 'Av. Coronel Díaz, C1425 CABA', lat: -34.5873, lng: -58.4166 },
    fare: 6800,
    vehicleType: 'moto',
    driverId: 'drv-205',
    driverName: 'Lucía Pérez',
    driverPhoto: '',
    driverVehicle: 'Honda Wave - Rojo',
    rating: 4,
    distance: 2.8,
    duration: 18,
    createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  },
  {
    id: 'trip-003',
    type: 'ride',
    status: 'completed',
    origin: { name: 'Recoleta Cemetery', address: 'Junín 1760, C1026 CABA', lat: -34.5844, lng: -58.3923 },
    destination: { name: 'Teatro Colón', address: 'Tucumán 1171, C1049 CABA', lat: -34.5997, lng: -58.3734 },
    fare: 1200,
    vehicleType: 'moto',
    driverId: 'drv-312',
    driverName: 'Juan Martínez',
    driverPhoto: '',
    driverVehicle: 'Yamaha Factor - Azul',
    rating: 5,
    distance: 2.1,
    duration: 9,
    createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'trip-004',
    type: 'ride',
    status: 'completed',
    origin: { name: 'Caminito', address: 'Caminito, La Boca, C1161 CABA', lat: -34.6345, lng: -58.3631 },
    destination: { name: 'San Telmo Market', address: 'Defensa 1094, C1065 CABA', lat: -34.6216, lng: -58.3744 },
    fare: 950,
    vehicleType: 'moto',
    driverId: 'drv-178',
    driverName: 'Sofía Rodríguez',
    driverPhoto: '',
    driverVehicle: 'Scooter eléctrico - Blanco',
    rating: 5,
    distance: 1.8,
    duration: 8,
    createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'trip-005',
    type: 'send',
    status: 'completed',
    origin: { name: 'El Ateneo Grand Splendid', address: 'Av. Santa Fe 1860, C1123 CABA', lat: -34.6033, lng: -58.3918 },
    destination: { name: 'Dot Baires Shopping', address: 'Av. Coronel Díaz 2811, C1425 CABA', lat: -34.5836, lng: -58.4142 },
    fare: 1400,
    vehicleType: 'moto',
    driverId: 'drv-445',
    driverName: 'Pedro Sánchez',
    driverPhoto: '',
    driverVehicle: 'Honda PCX - Gris',
    rating: 4,
    distance: 2.5,
    duration: 15,
    createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  },
];

const sampleNotifications: Notification[] = [
  {
    id: 'notif-001',
    title: '¡Viaje completado!',
    body: 'Calificá tu último viaje con Marcelo Gómez',
    type: 'trip',
    read: false,
    date: new Date(now.getTime() - 2 * 60 * 60 * 1000),
  },
  {
    id: 'notif-002',
    title: 'Promo exclusiva 🎉',
    body: 'Usá el código FOOD50 y obtené 50% en tu próximo delivery',
    type: 'promo',
    read: false,
    date: new Date(now.getTime() - 12 * 60 * 60 * 1000),
  },
  {
    id: 'notif-003',
    title: 'Saldo recargado',
    body: 'Se acreditaron $5.000 en tu billetera Unira',
    type: 'payment',
    read: true,
    date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'notif-004',
    title: 'Actualización del sistema',
    body: 'Mejoramos la búsqueda de conductores. Probá la nueva versión.',
    type: 'system',
    read: true,
    date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'notif-005',
    title: 'Cashback recibido',
    body: 'Ganaste $350 de cashback por tu compra en Green Life Bowls',
    type: 'payment',
    read: false,
    date: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  },
];

const sampleWalletMovements: WalletMovement[] = [
  {
    id: 'wm-001',
    type: 'topup',
    amount: 5000,
    description: 'Recarga con tarjeta Visa ****4242',
    date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    balance: 15000,
  },
  {
    id: 'wm-002',
    type: 'ride',
    amount: -1850,
    description: 'Viaje UniraAuto - Obelisco → Puerto Madero',
    date: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    balance: 10000,
  },
  {
    id: 'wm-003',
    type: 'food',
    amount: -6800,
    description: 'Parrilla La Porteña - Delivery',
    date: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    balance: 11850,
  },
  {
    id: 'wm-004',
    type: 'tip',
    amount: -200,
    description: 'Propina para Lucía Pérez',
    date: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    balance: 18650,
  },
  {
    id: 'wm-005',
    type: 'cashback',
    amount: 350,
    description: 'Cashback Green Life Bowls',
    date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    balance: 18850,
  },
];

// ─── Store ──────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set, get) => ({
  // Auth
  user: {
    uid: 'demo',
    email: 'demo@unira.app',
    name: 'Usuario Demo',
    phone: '+54 11 5555-0000',
    dni: '',
    avatar: '',
    role: 'passenger',
    isDriverApproved: true,
  },
  setUser: (user) => set({ user }),
  isFirebaseReady: false,
  setIsFirebaseReady: (v) => set({ isFirebaseReady: v }),

  // Navigation
  currentScreen: 'home',
  setCurrentScreen: (screen) => set({ currentScreen: screen }),
  previousScreen: '',
  navigateTo: (screen) => set((s) => ({ previousScreen: s.currentScreen, currentScreen: screen })),
  goBack: () =>
    set((s) => {
      const prev = s.previousScreen || 'home';
      return { currentScreen: prev, previousScreen: '' };
    }),

  // Ride
  origin: null,
  setOrigin: (p) => set({ origin: p }),
  destination: null,
  setDestination: (p) => set({ destination: p }),
  selectedVehicle: 'auto',
  setSelectedVehicle: (v) => set({ selectedVehicle: v }),
  currentTrip: null,
  setCurrentTrip: (t) => set({ currentTrip: t }),
  tripHistory: sampleTripHistory,
  addToHistory: (t) =>
    set((s) => ({ tripHistory: [t, ...s.tripHistory] })),
  tripVerificationCode: null,
  setTripVerificationCode: (code) => set({ tripVerificationCode: code }),

  // Wallet
  walletBalance: 15000,
  setWalletBalance: (b) => set({ walletBalance: b }),
  walletMovements: sampleWalletMovements,
  addMovement: (m) =>
    set((s) => ({
      walletMovements: [m, ...s.walletMovements],
      walletBalance: s.walletBalance + m.amount,
    })),

  // Food
  cart: [],
  addToCart: (item) =>
    set((s) => {
      const existing = s.cart.find((c) => c.menuItem.id === item.menuItem.id);
      if (existing) {
        return {
          cart: s.cart.map((c) =>
            c.menuItem.id === item.menuItem.id
              ? { ...c, quantity: c.quantity + item.quantity }
              : c
          ),
        };
      }
      return { cart: [...s.cart, item] };
    }),
  removeFromCart: (menuItemId) =>
    set((s) => ({
      cart: s.cart.filter((c) => c.menuItem.id !== menuItemId),
    })),
  updateCartQuantity: (menuItemId, qty) =>
    set((s) => {
      if (qty <= 0) {
        return { cart: s.cart.filter((c) => c.menuItem.id !== menuItemId) };
      }
      return {
        cart: s.cart.map((c) =>
          c.menuItem.id === menuItemId ? { ...c, quantity: qty } : c
        ),
      };
    }),
  clearCart: () => set({ cart: [] }),
  getCartTotal: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  },

  // Notifications
  notifications: sampleNotifications,
  addNotification: (n) =>
    set((s) => ({ notifications: [n, ...s.notifications] })),
  markAsRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  // Chat
  chatMessages: [],
  addChatMessage: (m) =>
    set((s) => ({ chatMessages: [...s.chatMessages, m] })),
  clearChat: () => set({ chatMessages: [] }),

  // Driver mode
  isOnline: false,
  setIsOnline: (v) => set({ isOnline: v }),

  // UI
  isLoading: false,
  setLoading: (v) => set({ isLoading: v }),
  toastMessage: '',
  toastType: 'info',
  showToast: (msg, type) => set({ toastMessage: msg, toastType: type }),
}));
