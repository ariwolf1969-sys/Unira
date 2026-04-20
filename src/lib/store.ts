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
export interface Community {
  id: string; name: string; description: string; icon: string;
  color: string; bg: string; members: number; postsCount: number; isJoined: boolean;
}
export interface CommunityPost {
  id: string; communityId: string; authorName: string; authorInitial: string;
  content: string; likes: number; comments: number; isLiked: boolean;
  tags?: string[]; createdAt: Date;
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
  // Communities
  joinedCommunities: ['deportes','empleos'],
  communityPosts: samplePosts,
  comments: sampleComments,
  joinCommunity: (id) => set((s) => ({ joinedCommunities: [...s.joinedCommunities, id] })),
  leaveCommunity: (id) => set((s) => ({ joinedCommunities: s.joinedCommunities.filter(x=>x!==id) })),
  addPost: (cid, content, author, init) => set((s) => ({ communityPosts: [{ id:Date.now().toString(), communityId:cid, authorName:author, authorInitial:init, content, likes:0, comments:0, isLiked:false, createdAt:'2025-04-21' }, ...s.communityPosts] })),
  likePost: (id) => set((s) => ({ communityPosts: s.communityPosts.map(p => p.id===id ? {...p, isLiked:!p.isLiked, likes:p.isLiked?p.likes-1:p.likes+1} : p) })),
  addComment: (pid, content, author, init) => set((s) => ({ comments: [{ id:Date.now().toString(), postId:pid, authorName:author, authorInitial:init, content, likes:0, isLiked:false, createdAt:'2025-04-21' }, ...s.comments], communityPosts: s.communityPosts.map(p => p.id===pid ? {...p, comments:p.comments+1} : p) })),
  likeComment: (id) => set((s) => ({ comments: s.comments.map(c => c.id===id ? {...c, isLiked:!c.isLiked, likes:c.isLiked?c.likes-1:c.likes+1} : c) })),
}));



