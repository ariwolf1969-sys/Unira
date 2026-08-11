import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────────────────────

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface User {
  uid: string;
  email: string;
  name: string;
  phone: string;
  dni: string;
  // ── Verification documents (base64 data URLs) ──
  dniFront: string;       // photo of DNI front
  dniBack: string;        // photo of DNI back
  facePhoto: string;      // selfie for face verification
  selfieWithDni: string; // selfie holding DNI (security verification)
  licenseFront: string;   // driver license front photo (only if isDriver)
  licenseBack: string;    // driver license back photo (only if isDriver)
  // ── Driver vehicle info (Session 17) ──
  vehicleType: string;       // id from VehicleType (moto, auto_4_puertas, etc.)
  vehiclePlate: string;      // patente
  vehicleBrand: string;      // marca
  vehicleModel: string;      // modelo
  vehicleYear?: number;      // año
  vehicleColor: string;      // color
  cedulaVerdeAzul: string;   // foto FRENTE de la cédula verde/azul
  cedulaVerdeAzulBack: string; // foto DORSO de la cédula verde/azul
  seguroVehiculo: string;    // foto del seguro del vehículo
  // ── Home address ──
  address: string;
  addressLat?: number;
  addressLng?: number;
  // ── Profile ──
  avatar: string;
  birthday: string;       // ISO date YYYY-MM-DD
  // ── Status ──
  role: 'passenger' | 'driver';
  isDriver: boolean;              // user applied to be a driver
  isDriverApproved: boolean;      // admin approved the application
  isAdmin: boolean;               // owner / admin of the cooperative
  isSocio: boolean;               // socio de la cooperativa (5% comisión) vs no socio (8%)
  verificationStatus: VerificationStatus;
  // ── Phone verification ──
  phoneVerifiedAt: string | null;   // ISO timestamp or null if not verified
  /** Telegram chat_id (when user has linked the bot). Drives OTP channel choice. */
  telegramChatId?: string | null;
  /** Preferred OTP channel: 'telegram' (default) | 'sms' | 'whatsapp' */
  otpChannel?: 'telegram' | 'sms' | 'whatsapp' | null;
  // ── Email verification ──
  emailVerifiedAt: string | null;   // ISO timestamp or null if not verified
  // ── Denormalized stats (synced from server on profile load) ──
  tripCountAsPassenger?: number;
  tripCountAsDriver?: number;
  totalSpent?: number;
  totalEarned?: number;
  averageRating?: number;
  ratingCount?: number;
  // ── Permissions onboarding (Grupo F) ──
  permissionsOnboardedAt?: string | null;
  cameraConsent?: boolean;
  microphoneConsent?: boolean;
  notificationsConsent?: boolean;
  locationConsent?: boolean;
  // ── Terms & Conditions (TyC) ──
  termsAcceptedAt?: string | null;     // ISO timestamp or null if not yet accepted
  termsVersion?: string;                // version of the TyC the user accepted
  recordingConsentGlobal?: boolean;     // global consent for trip recordings (still per-trip opt-in)
}

export interface UserStats {
  tripsAsPassenger: number;
  tripsAsDriver: number;
  totalSpent: number;
  totalEarned: number;
  averageRating: number;     // 0-5, rounded to 1 decimal
  ratingCount: number;
  upcomingBirthday: string | null;   // ISO date or null
  daysUntilBirthday: number | null;
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
  thirdParty?: string;
  thirdPhone?: string;
  thirdPartyPhoto?: string;
  distance?: number;
  duration?: number;
  waypoints?: Place[];
  /** Polyline of [lat,lng] tuples — saved when trip completes (Grupo C) */
  route?: [number, number][];
  createdAt: string; // ISO string for JSON serialization
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
  date: string; // ISO string for JSON serialization
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
  date: string; // ISO string
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'quick';
}
export interface Community {
  id: string; name: string; description: string; icon: string;
  color: string; bg: string; members: number; postsCount: number; isJoined: boolean;
}
export interface CommunityPost {
  id: string; communityId: string; authorName: string; authorInitial: string;
  content: string; likes: number; comments: number; isLiked: boolean;
  tags?: string[]; createdAt: string;
}

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface Comment {
  id: string; postId: string; authorName: string; authorInitial: string;
  content: string; likes: number; isLiked: boolean; createdAt: string;
}

interface AppStore {
  // Auth
  user: User | null;
  setUser: (user: User | null) => void;
  authToken: string | null;
  setAuthToken: (token: string | null) => void;
  isFirebaseReady: boolean;
  setIsFirebaseReady: (v: boolean) => void;
  isHydrated: boolean;
  // Profile stats (Grupo B) - cached from /api/users/me
  userStats: UserStats | null;

  // Lock screen
  isLocked: boolean;
  setIsLocked: (v: boolean) => void;
  pinHash: string | null;
  setPinHash: (hash: string | null) => void;
  biometricEnabled: boolean;
  setBiometricEnabled: (v: boolean) => void;
  biometricCredentialId: string | null;
  setBiometricCredentialId: (id: string | null) => void;

  // Verification OTP / email link (passed from AuthScreen registration to VerifyScreen)
  // These are populated when the API returns dev-mode values (no Twilio/Resend configured)
  // or even in production if we want to surface the OTP for testing.
  pendingDevOtp: string | null;
  setPendingDevOtp: (v: string | null) => void;
  pendingDevEmailUrl: string | null;
  setPendingDevEmailUrl: (v: string | null) => void;
  /** Telegram deep link to display on VerifyScreen when the user needs to open the bot. */
  pendingTelegramLink: string | null;
  setPendingTelegramLink: (v: string | null) => void;

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
  /** Selected trip for detail view (Grupo C) */
  selectedTripId: string | null;
  setSelectedTripId: (id: string | null) => void;
  openTripDetail: (id: string) => void;

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

  // Communities
  joinedCommunities: string[];
  communityPosts: CommunityPost[];
  comments: Comment[];
  joinCommunity: (id: string) => void;
  leaveCommunity: (id: string) => void;
  addPost: (cid: string, content: string, author: string, init: string) => void;
  likePost: (id: string) => void;
  addComment: (pid: string, content: string, author: string, init: string) => void;
  likeComment: (id: string) => void;

  // API Sync
  syncTripToServer: (trip: Trip) => Promise<void>;
  syncWalletToServer: () => Promise<void>;
  syncTopupToServer: (amount: number, description: string) => Promise<void>;
  loadFromServer: (userId: string) => Promise<void>;
  // Profile sync (Grupo B)
  syncProfileFromServer: (userId: string) => Promise<void>;
  updateProfileOnServer: (data: { name?: string; email?: string; address?: string; birthday?: string; avatar?: string }) => Promise<boolean>;

  // Persist helpers
  logout: () => void;
}

// ─── Static Data ────────────────────────────────────────────────────────────

export const sampleComments: Comment[] = [
  { id:'c1', postId:'1', authorName:'Juan P.', authorInitial:'JP', content:'Totalmente de acuerdo, De La Cruz esta como un demonio!', likes:5, isLiked:false, createdAt:'2025-04-21' },
  { id:'c2', postId:'1', authorName:'Maria L.', authorInitial:'ML', content:'El segundo gol fue una jugada de manual', likes:3, isLiked:true, createdAt:'2025-04-21' },
  { id:'c3', postId:'3', authorName:'Pedro S.', authorInitial:'PS', content:'Yo aplique, ojala me llamen!', likes:2, isLiked:false, createdAt:'2025-04-21' },
  { id:'c4', postId:'5', authorName:'Lucia M.', authorInitial:'LM', content:'Mucho animo! Yo corro hace 1 ano y la maraton es increible', likes:8, isLiked:false, createdAt:'2025-04-21' }
];

export interface Product { id:string; name:string; price:number; originalPrice:number; image:string; store:string; commission:number; category:string; rating:number; }
export const productsData: Product[] = [
  { id:'p1', name:'Auriculares Bluetooth Pro', price:8990, originalPrice:14990, image:'', store:'MercadoLibre', commission:5, category:'Tecnologia', rating:4.5 },
  { id:'p2', name:'Zapatillas Running Ultra', price:18990, originalPrice:24990, image:'', store:'Amazon', commission:4, category:'Deportes', rating:4.7 },
  { id:'p3', name:'Smartwatch Fitness Band', price:6990, originalPrice:9990, image:'', store:'Temu', commission:8, category:'Tecnologia', rating:4.2 },
  { id:'p4', name:'Set de Sartenes Antiadherente', price:12990, originalPrice:18990, image:'', store:'MercadoLibre', commission:6, category:'Hogar', rating:4.8 },
  { id:'p5', name:'Camiseta Algodon Premium', price:4990, originalPrice:7990, image:'', store:'Temu', commission:10, category:'Ropa', rating:4.3 },
  { id:'p6', name:'Cargador Inalambrico Rapido', price:5990, originalPrice:8990, image:'', store:'Amazon', commission:5, category:'Tecnologia', rating:4.6 },
  { id:'p7', name:'Lampara LED Inteligente', price:7490, originalPrice:11990, image:'', store:'MercadoLibre', commission:7, category:'Hogar', rating:4.4 },
  { id:'p8', name:'Mochila Laptop Impermeable', price:15990, originalPrice:21990, image:'', store:'Temu', commission:9, category:'Accesorios', rating:4.5 }
];
export const communitiesData: Community[] = [
  { id:'deportes', name:'Deportes', description:'Noticias, resultados y debate deportivo', icon:'⚽', color:'#10B981', bg:'#ECFDF5', members:2840, postsCount:156, isJoined:true },
  { id:'empleos', name:'Empleos', description:'Ofertas laborales y comparte tu CV', icon:'💼', color:'#3B82F6', bg:'#EFF6FF', members:5120, postsCount:342, isJoined:true },
  { id:'eventos', name:'Eventos', description:'Eventos por provincia y fecha', icon:'🎉', color:'#8B5CF6', bg:'#F5F3FF', members:1890, postsCount:89, isJoined:false },
  { id:'compras', name:'Compras', description:'Encuentra las mejores ofertas con comision para la cooperativa', icon:'🛒', color:'#F59E0B', bg:'#FFFBEB', members:960, postsCount:67, isJoined:false }
];

export const samplePosts: CommunityPost[] = [
  { id:'1', communityId:'deportes', authorName:'Carlos M.', authorInitial:'CM', content:'Increible la goleada de River anoche! 4-0 con golazo de De La Cruz. Que opinan?', likes:24, comments:8, isLiked:false, tags:['Futbol','River Plate'], createdAt:"2025-04-21" },
  { id:'2', communityId:'deportes', authorName:'Lucia P.', authorInitial:'LP', content:'Alguien ve el partido de tennis manana? Estoy buscando compania para ir al club.', likes:5, comments:12, isLiked:false, tags:['Tennis'], createdAt:"2025-04-21" },
  { id:'3', communityId:'empleos', authorName:'Maria G.', authorInitial:'MG', content:'Se busca desarrollador Frontend con experiencia en React. Remoto, full-time. Interesados manden DM.', likes:18, comments:5, isLiked:true, tags:['React','Remoto'], createdAt:"2025-04-21" },
  { id:'4', communityId:'empleos', authorName:'Diego R.', authorInitial:'DR', content:'Comparto mi CV: 5 anos en marketing digital. Disponible inmediato. Any feedback welcome!', likes:9, comments:3, isLiked:false, tags:['CV','Marketing'], createdAt:"2025-04-21" },
  { id:'5', communityId:'deportes', authorName:'Ana S.', authorInitial:'AS', content:'Maraton de Buenos Aires inscriptos? Entreno hace 3 meses, primera vez corriendo 42k!', likes:31, comments:15, isLiked:false, tags:['Running','Maraton'], createdAt:"2025-04-21" }
];

// ─── Sample Data (used only for new users) ──────────────────────────────────

function generateSampleTrips(): Trip[] {
  const now = new Date();
  return [
    {
      id: 'trip-001', type: 'ride', status: 'completed',
      origin: { name: 'Obelisco', address: 'Av. 9 de Julio, C1073 CABA', lat: -34.6037, lng: -58.3816 },
      destination: { name: 'Puerto Madero', address: 'Av. Alicia Moreau de Justo, C1107 CABA', lat: -34.6172, lng: -58.3639 },
      fare: 6500, vehicleType: 'auto_4_puertas', driverId: 'drv-101', driverName: 'Marcelo Gómez', driverPhoto: '', driverVehicle: 'Toyota Corolla - Negro', rating: 5, distance: 3.2, duration: 12,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'trip-002', type: 'food', status: 'completed',
      origin: { name: 'Parrilla La Porteña', address: 'Av. Corrientes 4500, C1414 CABA', lat: -34.603, lng: -58.44 },
      destination: { name: 'Palermo Soho', address: 'Av. Coronel Díaz, C1425 CABA', lat: -34.5873, lng: -58.4166 },
      fare: 6800, vehicleType: 'moto', driverId: 'drv-205', driverName: 'Lucía Pérez', driverPhoto: '', driverVehicle: 'Honda Wave - Rojo', rating: 4, distance: 2.8, duration: 18,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'trip-003', type: 'ride', status: 'completed',
      origin: { name: 'Recoleta Cemetery', address: 'Junín 1760, C1026 CABA', lat: -34.5844, lng: -58.3923 },
      destination: { name: 'Teatro Colón', address: 'Tucumán 1171, C1049 CABA', lat: -34.5997, lng: -58.3734 },
      fare: 4100, vehicleType: 'moto', driverId: 'drv-312', driverName: 'Juan Martínez', driverPhoto: '', driverVehicle: 'Yamaha Factor - Azul', rating: 5, distance: 2.1, duration: 9,
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function generateSampleNotifications(): Notification[] {
  const now = new Date();
  return [
    { id: 'notif-001', title: '¡Viaje completado!', body: 'Calificá tu último viaje con Marcelo Gómez', type: 'trip', read: false, date: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
    { id: 'notif-002', title: 'Promo exclusiva', body: 'Usá el código FOOD50 y obtené 50% en tu próximo delivery', type: 'promo', read: false, date: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString() },
    { id: 'notif-003', title: 'Saldo recargado', body: 'Se acreditaron $5.000 en tu billetera Unira', type: 'payment', read: true, date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'notif-005', title: 'Cashback recibido', body: 'Ganaste $350 de cashback por tu compra en Green Life Bowls', type: 'payment', read: false, date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() },
  ];
}

function generateSampleWalletMovements(): WalletMovement[] {
  const now = new Date();
  return [
    { id: 'wm-001', type: 'topup', amount: 5000, description: 'Recarga con tarjeta Visa ****4242', date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), balance: 15000 },
    { id: 'wm-002', type: 'ride', amount: -6500, description: 'Viaje TEYEVOAuto - Obelisco → Puerto Madero', date: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), balance: 10000 },
    { id: 'wm-003', type: 'food', amount: -6800, description: 'Parrilla La Porteña - Delivery', date: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(), balance: 11850 },
    { id: 'wm-005', type: 'cashback', amount: 350, description: 'Cashback Green Life Bowls', date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), balance: 18850 },
  ];
}

// ─── Persisted Store ────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      setUser: (user) => set({ user }),
      authToken: null,
      setAuthToken: (token) => set({ authToken: token }),
      isFirebaseReady: false,
      setIsFirebaseReady: (v) => set({ isFirebaseReady: v }),
      isHydrated: false,
      userStats: null,

      // Lock screen (isLocked not persisted - always starts locked)
      isLocked: true,
      setIsLocked: (v) => set({ isLocked: v }),
      pinHash: null,
      setPinHash: (hash) => set({ pinHash: hash }),
      biometricEnabled: false,
      setBiometricEnabled: (v) => set({ biometricEnabled: v }),
      biometricCredentialId: null,
      setBiometricCredentialId: (id) => set({ biometricCredentialId: id }),

      // Verification dev OTP / email URL — populated by AuthScreen on register,
      // consumed by VerifyScreen. Not persisted (ephemeral, only relevant in
      // the session where the user just registered).
      pendingDevOtp: null,
      setPendingDevOtp: (v) => set({ pendingDevOtp: v }),
      pendingDevEmailUrl: null,
      setPendingDevEmailUrl: (v) => set({ pendingDevEmailUrl: v }),
      pendingTelegramLink: null,
      setPendingTelegramLink: (v) => set({ pendingTelegramLink: v }),

      // Navigation (not persisted - always starts at home)
      currentScreen: 'home',
      setCurrentScreen: (screen) => set({ currentScreen: screen }),
      previousScreen: '',
      navigateTo: (screen) => set((s) => ({ previousScreen: s.currentScreen, currentScreen: screen })),
      goBack: () =>
        set((s) => {
          const prev = s.previousScreen || 'home';
          return { currentScreen: prev, previousScreen: '' };
        }),

      // Ride (origin/destination not persisted, history IS persisted)
      origin: null,
      setOrigin: (p) => set({ origin: p }),
      destination: null,
      setDestination: (p) => set({ destination: p }),
      selectedVehicle: 'auto_4_puertas',
      setSelectedVehicle: (v) => set({ selectedVehicle: v }),
      currentTrip: null,
      setCurrentTrip: (t) => set({ currentTrip: t }),
      tripHistory: [],
      addToHistory: (t) => {
        set((s) => ({ tripHistory: [t, ...s.tripHistory].slice(0, 50) })); // Keep max 50 trips
        // Sync to server (fire-and-forget)
        get().syncTripToServer(t);
      },
      tripVerificationCode: null,
      setTripVerificationCode: (code) => set({ tripVerificationCode: code }),
      selectedTripId: null,
      setSelectedTripId: (id) => set({ selectedTripId: id }),
      openTripDetail: (id) =>
        set((s) => ({
          previousScreen: s.currentScreen,
          selectedTripId: id,
          currentScreen: 'trip-detail',
        })),

      // Wallet (persisted)
      walletBalance: 15000,
      setWalletBalance: (b) => set({ walletBalance: b }),
      walletMovements: [],
      addMovement: (m) => {
        set((s) => ({
          walletMovements: [m, ...s.walletMovements].slice(0, 100), // Keep max 100 movements
          walletBalance: s.walletBalance + m.amount,
        }));
        // Sync wallet state to server (fire-and-forget) for non-topup movements
        if (m.type !== 'topup') {
          get().syncWalletToServer();
        }
      },

      // Food (cart persisted)
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

      // Notifications (persisted)
      notifications: [],
      addNotification: (n) =>
        set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50) })),
      markAsRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      // Chat (not persisted - ephemeral)
      chatMessages: [],
      addChatMessage: (m) =>
        set((s) => ({ chatMessages: [...s.chatMessages, m] })),
      clearChat: () => set({ chatMessages: [] }),

      // Driver mode (persisted)
      isOnline: false,
      setIsOnline: (v) => set({ isOnline: v }),

      // UI (not persisted)
      isLoading: false,
      setLoading: (v) => set({ isLoading: v }),
      toastMessage: '',
      toastType: 'info',
      showToast: (msg, type) => set({ toastMessage: msg, toastType: type }),

      // Communities (persisted)
      joinedCommunities: ['deportes', 'empleos'],
      communityPosts: samplePosts,
      comments: sampleComments,
      joinCommunity: (id) => set((s) => ({ joinedCommunities: [...s.joinedCommunities, id] })),
      leaveCommunity: (id) => set((s) => ({ joinedCommunities: s.joinedCommunities.filter(x => x !== id) })),
      addPost: (cid, content, author, init) => set((s) => ({
        communityPosts: [{ id: Date.now().toString(), communityId: cid, authorName: author, authorInitial: init, content, likes: 0, comments: 0, isLiked: false, createdAt: new Date().toISOString() }, ...s.communityPosts]
      })),
      likePost: (id) => set((s) => ({
        communityPosts: s.communityPosts.map(p => p.id === id ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 } : p)
      })),
      addComment: (pid, content, author, init) => set((s) => ({
        comments: [{ id: Date.now().toString(), postId: pid, authorName: author, authorInitial: init, content, likes: 0, isLiked: false, createdAt: new Date().toISOString() }, ...s.comments],
        communityPosts: s.communityPosts.map(p => p.id === pid ? { ...p, comments: p.comments + 1 } : p)
      })),
      likeComment: (id) => set((s) => ({
        comments: s.comments.map(c => c.id === id ? { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 } : c)
      })),

      // ─── API Sync Methods ──────────────────────────────────────────

      syncTripToServer: async (trip: Trip) => {
        const { user } = get();
        if (!user) return;
        try {
          await fetch('/api/trips', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.uid, trip }),
          });
        } catch {
          // Silent fallback - local state is already updated
        }
      },

      syncWalletToServer: async () => {
        // This syncs wallet balance and movements by just updating the user's balance
        // Individual movements are synced via syncTopupToServer or trip completion
        // This is a no-op for now since the balance is maintained locally
      },

      syncTopupToServer: async (amount: number, description: string) => {
        const { user } = get();
        if (!user) return;
        try {
          await fetch('/api/wallet/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.uid, amount, description }),
          });
        } catch {
          // Silent fallback - local state is already updated
        }
      },

      loadFromServer: async (userId: string) => {
        try {
          // Fetch trips from server
          const tripsRes = await fetch(`/api/trips?userId=${userId}`);
          if (tripsRes.ok) {
            const { trips } = await tripsRes.json() as { trips: Trip[] };
            if (trips && trips.length > 0) {
              set((s) => {
                // Merge server trips with local trips, dedup by id
                const localIds = new Set(s.tripHistory.map(t => t.id));
                const newTrips = trips.filter(t => !localIds.has(t.id));
                const merged = [...trips, ...newTrips]
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 50);
                return { tripHistory: merged };
              });
            }
          }

          // Fetch wallet from server
          const walletRes = await fetch(`/api/wallet?userId=${userId}`);
          if (walletRes.ok) {
            const { balance, movements } = await walletRes.json() as { balance: number; movements: WalletMovement[] };
            if (movements && movements.length > 0) {
              set((s) => {
                const localIds = new Set(s.walletMovements.map(m => m.id));
                const newMovements = movements.filter(m => !localIds.has(m.id));
                const merged = [...movements, ...newMovements]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 100);
                // Use server balance only if there are server movements
                return { walletMovements: merged, walletBalance: balance ?? s.walletBalance };
              });
            } else if (balance !== undefined) {
              set({ walletBalance: balance });
            }
          }
        } catch {
          // Silent fallback - keep local state
        }
      },

      // ─── Profile sync (Grupo B) ─────────────────────────────────────────
      syncProfileFromServer: async (userId: string) => {
        try {
          const res = await fetch(`/api/users/me?userId=${userId}`);
          if (!res.ok) return;
          const data = await res.json() as {
            user: Record<string, unknown>;
            stats: UserStats;
            wallet: { balance: number };
            birthdayBonus: { granted: boolean; amount?: number } | null;
          };
          // Map server user fields back to client User interface
          const u = data.user;
          // ── Role is a client-side UI preference (which mode the user is
          // currently in: 'driver' vs 'passenger'). The server stores the
          // last-known role for default-on-reload, but the LOCAL value is
          // always authoritative for the current session — otherwise, opening
          // "Mi cuenta" right after switching role via "cambiar rol" would
          // syncProfileFromServer() and revert the role back to whatever the
          // server had before the switch, causing the driver config section
          // to disappear. Preserve the local role if it's already set.
          const existingUser = get().user;
          const localRole = existingUser?.role;
          const serverRole = (u.role as 'passenger' | 'driver') ?? 'passenger';
          const mappedUser: User = {
            uid: u.id as string,
            email: (u.email as string) ?? '',
            name: u.name as string,
            phone: u.phone as string,
            dni: (u.dni as string) ?? '',
            dniFront: '', dniBack: '', facePhoto: '', selfieWithDni: '', licenseFront: '', licenseBack: '',
            // Driver vehicle info (Session 17)
            vehicleType: (u.vehicleType as string) ?? '',
            vehiclePlate: (u.vehiclePlate as string) ?? '',
            vehicleBrand: (u.vehicleBrand as string) ?? '',
            vehicleModel: (u.vehicleModel as string) ?? '',
            vehicleYear: (u.vehicleYear as number | undefined) ?? undefined,
            vehicleColor: (u.vehicleColor as string) ?? '',
            cedulaVerdeAzul: (u.cedulaVerdeAzul as string) ?? '',
            cedulaVerdeAzulBack: (u.cedulaVerdeAzulBack as string) ?? '',
            seguroVehiculo: (u.seguroVehiculo as string) ?? '',
            address: (u.address as string) ?? '',
            addressLat: (u.addressLat as number | undefined) ?? undefined,
            addressLng: (u.addressLng as number | undefined) ?? undefined,
            avatar: (u.avatar as string) ?? '',
            birthday: (u.birthday as string) ?? '',
            role: localRole ?? serverRole,
            isDriver: !!u.isDriver,
            isDriverApproved: !!u.isDriverApproved,
            isAdmin: !!u.isAdmin,
            isSocio: u.isSocio === undefined ? true : !!u.isSocio,  // default true (socio) until backend exposes the field
            verificationStatus: (u.verificationStatus as VerificationStatus) ?? 'pending',
            phoneVerifiedAt: (u.phoneVerifiedAt as string | null) ?? null,
            telegramChatId: (u.telegramChatId as string | null) ?? null,
            otpChannel: (u.otpChannel as 'telegram' | 'sms' | 'whatsapp' | null) ?? 'telegram',
            emailVerifiedAt: (u.emailVerifiedAt as string | null) ?? null,
            tripCountAsPassenger: u.tripCountAsPassenger as number | undefined,
            tripCountAsDriver: u.tripCountAsDriver as number | undefined,
            totalSpent: u.totalSpent as number | undefined,
            totalEarned: u.totalEarned as number | undefined,
            averageRating: u.averageRating as number | undefined,
            ratingCount: u.ratingCount as number | undefined,
          };
          // Preserve photo blobs from existing local user (server omits them to keep payload small)
          const existing = get().user;
          if (existing && existing.uid === mappedUser.uid) {
            mappedUser.dniFront = existing.dniFront || mappedUser.dniFront;
            mappedUser.dniBack = existing.dniBack || mappedUser.dniBack;
            mappedUser.facePhoto = existing.facePhoto || mappedUser.facePhoto;
            mappedUser.selfieWithDni = existing.selfieWithDni || mappedUser.selfieWithDni;
            mappedUser.licenseFront = existing.licenseFront || mappedUser.licenseFront;
            mappedUser.licenseBack = existing.licenseBack || mappedUser.licenseBack;
            mappedUser.cedulaVerdeAzul = existing.cedulaVerdeAzul || mappedUser.cedulaVerdeAzul;
            mappedUser.cedulaVerdeAzulBack = existing.cedulaVerdeAzulBack || mappedUser.cedulaVerdeAzulBack;
            mappedUser.seguroVehiculo = existing.seguroVehiculo || mappedUser.seguroVehiculo;
          }
          set({
            user: mappedUser,
            userStats: data.stats,
            walletBalance: data.wallet?.balance ?? get().walletBalance,
          });
          // If birthday bonus was granted, show a toast
          if (data.birthdayBonus?.granted) {
            get().showToast(`¡Feliz cumpleaños! Te regalamos $${data.birthdayBonus.amount} en tu billetera`, 'success');
          }
        } catch {
          // Silent fallback - keep local state
        }
      },

      updateProfileOnServer: async (data: { name?: string; email?: string; address?: string; birthday?: string; avatar?: string }) => {
        const { user } = get();
        if (!user) return false;
        try {
          const res = await fetch('/api/users/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.uid, ...data }),
          });
          if (!res.ok) return false;
          // After PATCH, refresh full profile from server to keep stats in sync
          await get().syncProfileFromServer(user.uid);
          return true;
        } catch {
          return false;
        }
      },

      // Logout
      logout: () => {
        set({
          user: null,
          authToken: null,
          userStats: null,
          currentScreen: 'auth',
          previousScreen: '',
          origin: null,
          destination: null,
          currentTrip: null,
          tripVerificationCode: null,
          selectedTripId: null,
          isOnline: false,
          isLocked: true,
          // Clear lock credentials on logout so next user starts fresh
          pinHash: null,
          biometricEnabled: false,
          biometricCredentialId: null,
          chatMessages: [],
          isLoading: false,
          toastMessage: '',
          toastType: 'info',
        });
      },
    }),
    {
      name: 'unira-app-storage',
      // Only persist these keys (transient UI state is NOT persisted)
      partialize: (state) => ({
        user: state.user,
        authToken: state.authToken,
        tripHistory: state.tripHistory,
        walletBalance: state.walletBalance,
        walletMovements: state.walletMovements,
        cart: state.cart,
        notifications: state.notifications,
        isOnline: state.isOnline,
        joinedCommunities: state.joinedCommunities,
        communityPosts: state.communityPosts,
        comments: state.comments,
        pinHash: state.pinHash,
        biometricEnabled: state.biometricEnabled,
        biometricCredentialId: state.biometricCredentialId,
      }),
      // Custom storage with Date-aware JSON parsing (SSR safe)
      storage: typeof window !== 'undefined' ? {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            return JSON.parse(str, (key, value) => {
              if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
                return new Date(value);
              }
              return value;
            });
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      } : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
      // Initialize with sample data for new users, mark as hydrated
      onRehydrateStorage: () => (state) => {
        if (state) {
          // If no trip history, this is a new user - add sample data
          if (state.tripHistory.length === 0) {
            state.tripHistory = generateSampleTrips();
          }
          if (state.notifications.length === 0) {
            state.notifications = generateSampleNotifications();
          }
          if (state.walletMovements.length === 0) {
            state.walletMovements = generateSampleWalletMovements();
          }

          // ── Migration: backfill new User fields for older persisted users ──
          // Users saved before the verification overhaul (Tanda 4) won't have
          // dniFront / dniBack / facePhoto / licensePhoto / address / isDriver /
          // verificationStatus on their persisted User object. Fill in safe
          // defaults so the UI doesn't crash on undefined access.
          if (state.user) {
            const u = state.user as User & Partial<User> & { licensePhoto?: string };
            u.dniFront = u.dniFront ?? '';
            u.dniBack = u.dniBack ?? '';
            u.facePhoto = u.facePhoto ?? '';
            u.selfieWithDni = (u as any).selfieWithDni ?? '';
            // Migrate old single licensePhoto field to new licenseFront (back optional)
            if (!u.licenseFront && u.licensePhoto) {
              u.licenseFront = u.licensePhoto;
            }
            u.licenseFront = u.licenseFront ?? '';
            u.licenseBack = u.licenseBack ?? '';
            u.address = u.address ?? '';
            u.birthday = u.birthday ?? '';
            u.isDriver = u.isDriver ?? (u.role === 'driver');
            u.isAdmin = u.isAdmin ?? false;
            u.isSocio = u.isSocio ?? true;  // default socio (5% comisión)
            u.verificationStatus = u.verificationStatus ?? 'pending';
            u.phoneVerifiedAt = u.phoneVerifiedAt ?? null;
            u.emailVerifiedAt = u.emailVerifiedAt ?? null;
            // ── Session 17 migration: backfill driver vehicle fields ──
            // Old persisted drivers don't have vehicleType/Plate/Brand/Model/Year/Color
            // or cedulaVerdeAzul/seguroVehiculo. Map legacy `auto`/`auto_premium`/`taxi`
            // vehicleType values to the new schema.
            u.vehicleType = u.vehicleType ?? '';
            // Migrate legacy vehicleType values
            if (u.vehicleType === 'auto' || u.vehicleType === 'taxi') {
              u.vehicleType = 'auto_4_puertas';
            } else if (u.vehicleType === 'auto_premium') {
              u.vehicleType = 'auto_alta_gama';
            }
            u.vehiclePlate = u.vehiclePlate ?? '';
            u.vehicleBrand = u.vehicleBrand ?? '';
            u.vehicleModel = u.vehicleModel ?? '';
            u.vehicleColor = u.vehicleColor ?? '';
            u.cedulaVerdeAzul = u.cedulaVerdeAzul ?? '';
            u.cedulaVerdeAzulBack = u.cedulaVerdeAzulBack ?? '';
            u.seguroVehiculo = u.seguroVehiculo ?? '';
            // Grupo F: permissions onboarding migration
            u.permissionsOnboardedAt = u.permissionsOnboardedAt ?? null;
            u.cameraConsent = u.cameraConsent ?? false;
            u.microphoneConsent = u.microphoneConsent ?? false;
            u.notificationsConsent = u.notificationsConsent ?? false;
            u.locationConsent = u.locationConsent ?? true;
          }
        }
        // Mark as hydrated after rehydration completes
        setTimeout(() => {
          useAppStore.setState({ isHydrated: true });
        }, 0);
      },
    }
  )
);
