# Unira Worklog

## [2025-01-XX] Session 1 — Core Infrastructure

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/lib/firebase.ts` | Created | Firebase App, Auth, and Firestore initialization using the Cooperativa Unira project config |
| `src/lib/store.ts` | Created | Zustand global store with 10+ slices: auth, navigation, ride, wallet, food/cart, notifications, chat, driver mode, UI |
| `src/lib/places.ts` | Created | 40 Buenos Aires POIs with real coordinates, 4 vehicle types, 8 Argentine-themed restaurants (48 menu items), quick chat messages, 4 promotions |
| `src/lib/utils.ts` | Modified | Kept existing `cn()` helper; added `formatCurrency`, `haversineDistance`, `calculateFare`, `timeAgo`, `generateId`, `truncateText` |
| `src/app/globals.css` | Modified | Added Unira custom styles: gradient classes, mobile-app container, screen transition animations, hide-scrollbar utility, leaflet overrides, safe-bottom |
| `src/app/layout.tsx` | Modified | Switched to Plus Jakarta Sans (Google Fonts), set metadata title to "Unira", added viewport config with max-scale=1 for native app feel, changed lang to "es" |

### Key Decisions
- **Zustand store** initialized with realistic sample data: 5 trip history entries (ride, food, send types), 5 wallet movements, 5 notifications, wallet balance of $15.000
- **Places data** covers all major Buenos Aires neighborhoods: Microcentro, San Telmo, La Boca, Puerto Madero, Palermo, Recoleta, Caballito, Almagro
- **Restaurant menus** follow Argentine cuisine themes: empanadas, parrilla/asado, pizza porteña, sushi, café, hamburguesas, milanesas, healthy/vegan
- **Fare calculation** uses haversine distance + vehicle type base/per-km/per-min rates, rounded to nearest $10
- **All TypeScript types** exported from store.ts for shared use across components

### Verification
- ✅ `bun run lint` passes with zero errors
- ✅ Dev server compiles successfully
- ✅ All files have no TODOs or placeholders

---

## [2025-01-XX] Session 2 — Main Page Shell & Auth/Setup Screens

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/app/page.tsx` | Rewritten | App shell with `useSyncExternalStore` hydration guard, screen router via `currentScreen` Zustand state, toast overlay, emergency button, placeholder screens for 12 routes |
| `src/components/unira/SplashScreen.tsx` | Created | Full-screen splash with teal gradient logo, animated 3-dot loader, auto-transitions after 2.5s to setup/auth/home based on state |
| `src/components/unira/SetupScreen.tsx` | Created | Firebase config JSON editor with validation, "Ver ejemplo" sample config, save-to-localStorage, skip-to-demo-mode option |
| `src/components/unira/AuthScreen.tsx` | Created | Login/Register tab toggle with Firebase Auth integration (`signInWithEmailAndPassword`/`createUserWithEmailAndPassword`), demo mode fallback, form validation, password toggle |
| `src/components/unira/RoleScreen.tsx` | Created | Role selection with Passenger/Driver cards featuring teal gradient on selection, feature lists, quick demo access |
| `src/components/unira/BottomNav.tsx` | Created | Fixed bottom nav with 5 tabs (Home, Pedir, Más, Actividad, Cuenta), badge indicators for cart items and unread notifications, hidden on auth/setup/role screens |

### Navigation Flow
1. **Splash** (2.5s) → checks `user` and `localStorage` for firebase config
2. **Setup** (if no firebase config) → save config → **Auth** / skip → **Role**
3. **Auth** → Login/Register with Firebase or demo mode → **Role**
4. **Role** → select passenger/driver → **Home**
5. **Home** + other screens → bottom nav navigation

### Key Decisions
- **`useSyncExternalStore`** used instead of `useState + useEffect` for hydration guard to satisfy React strict lint rules
- **Dark theme** (`#0A0F14` background) used for splash/setup/auth/role screens for native app feel
- **Light theme** (`#F5F7FA` background) used for main app screens (home, ride, food, etc.)
- **Toast system** auto-dismisses after 3 seconds, supports success/error/info types with icons
- **Emergency button** (red floating action button) shown on all authenticated screens
- **12 placeholder screens** created for routes not yet implemented, each with contextual icon and description
- **Demo mode** fully functional: creates fake user `demo@unira.app` without any Firebase dependency
- **Bottom nav** conditionally rendered only on appropriate screens using a `Set` lookup

### Verification
- ✅ `bun run lint` passes with zero errors
- ✅ Dev server compiles successfully with hot reload

---

## [2025-01-XX] Session 3 — Home Screen (Gojek-style)

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/components/unira/HomeScreen.tsx` | Created | Full Gojek-style home screen with 6 sections: greeting header with notification bell, search bar, promotional banners (horizontal snap scroll), quick services grid (2×4), frequent destinations, nearby restaurants |
| `src/app/page.tsx` | Modified | Replaced 'home' placeholder with `<HomeScreen />`; added 3 new placeholder screens: `chat`, `admin`, `food-restaurant`; updated Lucide imports |
| `src/components/unira/BottomNav.tsx` | Modified | Extended `screensWithNav` set to include `chat`, `admin`, `food-restaurant` |

### Home Screen Sections
1. **Header** — White card with `rounded-b-3xl`, greeting based on time of day (Buenos días/tardes/noches), user's first name (or "Usuario" for demo), notification bell with unread count badge
2. **Search Bar** — Rounded `bg-[#F5F7FA]` input with search icon, placeholder "¿A dónde vas?", navigates to ride screen
3. **Promotional Banners** — Horizontal snap-scroll row of 4 gradient cards from `promotions` array, each with icon watermark, title, description, promo code badge
4. **Quick Services Grid** — White card with 2×4 grid of 8 service icons (UniraRide/Moto/Food/Envíos/Pay/Chat/Help/Admin), each in a colored rounded square, tap handlers wired to store navigation
5. **Recent Destinations** — "Destinos frecuentes" section with 4 BA landmarks (Obelisco, Palermo Soho, Puerto Madero, Recoleta Cemetery), each card sets destination and navigates to ride
6. **Nearby Restaurants** — "Restaurantes cerca tuyo" horizontal scroll with 3 restaurant cards showing gradient placeholder, delivery fee badge, rating stars, delivery time, category tag

### Key Decisions
- **Framer Motion** staggered `fadeUp` animations on each section for polished entrance feel
- **`hide-scrollbar`** utility class used on horizontal scroll containers for clean mobile look
- **Snap scroll** (`snap-x snap-mandatory`) on promo and restaurant carousels
- **`Restaurant` gradient map** by category (Empanadas→orange, Parrilla→red, etc.) for visually distinct placeholder cards
- **Promo icon mapping** dynamically resolves string icon names from `places.ts` to Lucide components
- **`pb-24`** bottom padding to account for bottom nav + emergency button overlap

### Verification
- ✅ `bun run lint` passes with zero errors
- ✅ Dev server compiles successfully (Turbopack, no warnings)

---

## [2025-01-XX] Session 4 — Ride Booking Screen

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/components/unira/RideScreen.tsx` | Created | Complete ride booking flow with 6 internal steps: Input, Searching, Driver Found, In Trip, Rate, Receipt |
| `src/app/page.tsx` | Modified | Replaced 'ride' placeholder with `<RideScreen />` import |

### RideScreen — 6-Step Flow

1. **Input Screen** — "¿A dónde vas?" title, origin/destination inputs with green/red colored dots, debounced Nominatim API autocomplete (fallback to local `places.ts`), vehicle type selection cards (4 vehicles from `vehicleTypes` with fare calculation via `calculateFare`), payment method selector (Efectivo/Billetera/Tarjeta), "Pedir Unira" button with price. Bottom sheet style with grab handle, rounded top. Quick destinations grid shown when no origin set.

2. **Searching** — Pulsing circle animation with vehicle icon, "Buscando conductor..." title, "Conectando con socios cercanos" subtitle, animated dots, "Cancelar" button. Auto-transitions to step 3 after 4 seconds.

3. **Driver Found** — Driver avatar (gradient circle with initials), name, star rating, vehicle info (brand, model, color, plate), trip route summary (origin → destination with distance/duration), fare amount, "Llamar" (teal) and "Mensaje" (white) action buttons. Auto-transitions to step 4 after 3 seconds.

4. **In Trip** — Status text toggles between "Viajando" and "Llegando" (>90% progress), circular SVG progress indicator with ETA countdown in minutes, horizontal gradient progress bar, destination name, mini driver info card with call button. Progress simulated over ~15 seconds (500ms updates).

5. **Rate & Tip** — "¿Cómo fue tu viaje?" title with completed check icon, driver name and avatar, interactive 5-star rating (amber fill on selection), tip selector buttons (Sin propina / $500 / $1.000 / $2.000), "Confirmar" button (disabled until rating selected).

6. **Receipt** — Teal gradient header with check icon, trip route with addresses, 3-column stats (distance, duration, vehicle type), itemized price breakdown (base + distance + time + tip), payment method indicator, total in teal, "Volver al inicio" button.

### Technical Details
- **Nominatim autocomplete**: Debounced 400ms fetch to `https://nominatim.openstreetmap.org/search?format=json&q=...&countrycodes=ar&limit=5`, falls back to filtering local `places.ts` on error
- **Fare calculation**: Uses `calculateFare` from `utils.ts` with haversine distance and estimated duration per vehicle type
- **Vehicle icons**: Dynamic Lucide icon mapping (`Bike`→moto, `Car`→auto, `Crown`→premium, `CarFront`→taxi)
- **Step transitions**: CSS opacity + transform transitions (200ms) between steps
- **Store integration**: Calls `addToHistory` with complete `Trip` object, calls `addMovement` for wallet deduction and tip on receipt step
- **Payment methods**: Three options (Efectivo, Billetera, Tarjeta) — wallet payments trigger wallet balance deduction
- **Random driver data**: Pool of 6 Argentine-themed sample drivers with realistic names, vehicles, and ratings
- **6 sample drivers**: Marcelo Gómez, Lucía Pérez, Juan Martínez, Sofía Rodríguez, Pedro Sánchez, Ana Torres
- **All text in Argentine Spanish**: "¿A dónde vas?", "Punto de partida", "Buscando conductor...", "¿Cómo fue tu viaje?", "Propina", "Viaje completado", etc.

### Design
- Teal (#0EA5A0) for primary buttons, accents, progress indicators
- Orange (#FF8C42) for moto vehicle cards and "POPULAR" badge
- White card backgrounds with bottom sheet slide-up animation
- Emerald green/red dots for origin/destination visual indicators
- Rounded corners (rounded-2xl / rounded-3xl) throughout
- Mobile-first layout with max content area, pb-24 for bottom nav clearance

### Verification
- ✅ `bun run lint` passes with zero errors/warnings
- ✅ Dev server compiles successfully

---

## [2025-01-XX] Session 5 — Food Delivery & Package Delivery Screens

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/components/unira/FoodScreen.tsx` | Created | Complete food delivery experience with 3 internal steps: Restaurant List, Restaurant Detail, Cart |
| `src/components/unira/SendScreen.tsx` | Created | Complete package delivery experience with 4 internal steps: Package Info, Addresses, Quote, Tracking |
| `src/app/page.tsx` | Modified | Replaced 'food', 'send', and 'food-restaurant' placeholders with `<FoodScreen />` and `<SendScreen />` imports; removed unused `UtensilsCrossed` import |

### FoodScreen — 3-Step Flow

1. **Restaurant List** — "UniraFood" title with utensils icon (orange #FF8C42), search bar for filtering restaurants by name/category, horizontal scroll category filter chips (Todos, Pizza, Hamburguesas, Empanadas, Sushi, Asiática, Café, Parrilla, Saludable, Milanesas), restaurant cards showing gradient placeholder image with initial, name, category badge, star rating, delivery time, delivery fee, "Ver menú" button. Empty state with search icon when no results.

2. **Restaurant Detail** — Gradient header image with restaurant initial and name overlay, back button, restaurant info card (rating, delivery time, fee), horizontal scroll menu category tabs, menu item cards with colored placeholder square, name, truncated description, price in orange, "+" add button or quantity controls (-/+). Floating cart button at bottom when cart has items showing item count + total price + "Ver carrito".

3. **Cart** — "Tu pedido" title, restaurant info card, scrollable list of cart items with quantity controls and per-item price, price breakdown (subtotal, delivery fee, total), "Realizar pedido" button. Empty cart state with shopping cart icon and "Ver menú" button. On confirm: toast success, trip added to history, wallet movement (deduction), cart cleared, auto-navigates to home after 2 seconds.

### SendScreen — 4-Step Flow

1. **Package Info** — "UniraEnvíos" title with package icon (blue #3B82F6), package size selector grid (2×2) with radio-style cards: Sobre (envelope, small), Caja chica (package, medium), Caja grande (box, large), Especial (alert-circle, fragile). Weight input (kg), description textarea (optional), "Continuar" button.

2. **Addresses** — Bottom sheet style with grab handle, origin/destination inputs with green/red colored dots (same Nominatim autocomplete pattern as RideScreen), "Usar ubicación actual" button, "Cotizar envío" button (disabled until both addresses set).

3. **Quote** — Package summary card (icon, name, weight, description), route card with origin → destination dots and addresses, distance and estimated time, itemized price breakdown (base fare by package size, distance cost, weight surcharge for >5kg), total in blue, "Confirmar envío" button.

4. **Tracking** — Circular SVG progress indicator with truck icon and ETA countdown (20-second simulation), vertical progress steps (Recogido → En camino → Cercano → Entregado) with animated state transitions, route summary. "Entregado" final state with large green check icon, success message, "Volver" button to home. On delivery: trip saved to history, wallet deduction applied.

### Technical Details
- **Store integration**: Both screens use `useAppStore()` for cart operations (`addToCart`, `removeFromCart`, `updateCartQuantity`, `clearCart`, `getCartTotal`), wallet movements (`addMovement`), trip history (`addToHistory`), navigation (`setCurrentScreen`), and toast notifications (`showToast`)
- **Nominatim autocomplete**: Same debounced 400ms pattern as RideScreen with local `places.ts` fallback, adapted for SendScreen's origin/destination inputs
- **Step transitions**: CSS opacity + translate-y transitions (200ms) between steps, consistent with existing screens
- **Menu filtering**: `useMemo` for filtered restaurants and menu items; computed `activeMenuTabResolved` instead of `useEffect` for setting initial tab
- **Package pricing**: Base price + per-km rate by size + weight surcharge (>5kg at $100/kg)
- **Send pricing**: `haversineDistance` for distance, ~25km/h average speed for duration estimate
- **All text in Argentine Spanish**: "UniraFood", "UniraEnvíos", "Ver menú", "Tu pedido", "Realizar pedido", "Carrito vacío", "Cotizar envío", "Confirmar envío", "Seguimiento", "¡Entregado!", etc.
- **No `useEffect` for state initialization**: Used computed values (`activeMenuTabResolved`) instead of `useEffect` + `setState` to avoid `react-hooks/set-state-in-effect` lint errors

### Design
- Orange (#FF8C42) accent for all food delivery elements (buttons, badges, prices, category chips)
- Blue (#3B82F6) accent for all send/envíos elements (buttons, icons, price highlights)
- White card backgrounds with `#F5F7FA` page background
- Restaurant gradient map by category for visually distinct placeholder images
- Menu item color map by subcategory for variety in item cards
- Rounded corners (rounded-2xl / rounded-3xl) throughout
- Mobile-first layout with pb-24 for bottom nav clearance
- `hide-scrollbar` on horizontal scroll containers
- Floating cart button with shadow

### Verification
- ✅ `bun run lint` passes with zero errors/warnings
- ✅ Dev server compiles successfully (Turbopack, no warnings)

---

## [2025-01-XX] Session 6 — Wallet, History & Profile Screens

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/components/unira/WalletScreen.tsx` | Created | GoPay-style wallet screen with balance card, quick actions (Enviar/Recibir/Pagar), filterable movement list grouped by date (Hoy/Ayer), recarga modal with amount input and quick-select buttons |
| `src/components/unira/HistoryScreen.tsx` | Created | Activity history screen with filter tabs (Todos/Viajes/Comidas/Envíos), date-grouped trip cards with type-colored left borders, origin→destination routes, status badges, fare display |
| `src/components/unira/ProfileScreen.tsx` | Created | User profile screen with teal gradient header card (avatar, name, email), stats row (trips/rating/member since), 6 menu items with icons, danger zone (change role, logout), app version footer |
| `src/app/page.tsx` | Modified | Replaced `history`, `profile`, and `wallet` placeholders with actual `<HistoryScreen />`, `<ProfileScreen />`, and `<WalletScreen />` components |

### WalletScreen Details
- **Balance Card**: Teal gradient (`#0EA5A0` → `#0B8A86`) with white text, displays current `walletBalance` from store, "Recargar" button with white outline style
- **Quick Actions**: 3 icon buttons in a row — Enviar (Send icon, teal), Recibir (Download icon, emerald), Pagar (CreditCard icon, purple) — each triggers a toast demo
- **Movimientos Section**: 5 filter tabs (Todos/Cargas/Viajes/Comidas/Envíos), list of wallet movements from store, each with colored icon based on type, description, amount (green for income, red for expense), relative date via `timeAgo`. Grouped by "Hoy", "Ayer", "Esta semana" using date comparison logic
- **Recargar Modal**: Bottom sheet with slide-up animation, dollar-prefixed number input, quick select buttons ($5.000/$10.000/$20.000) with active state, "Confirmar recarga" button. On confirm: calls `addMovement` with topup type (updates balance automatically via store), generates random card last-4 digits, shows success toast, closes modal
- **Movement type icons**: topup (green ArrowUpCircle), ride (teal Car), food (orange Utensils), send (blue Truck), tip (purple Gift), cashback (amber TrendingUp)

### HistoryScreen Details
- **Filter Tabs**: Todos/Viajes/Comidas/Envíos with teal active state, horizontal scroll with hide-scrollbar
- **Date Grouping**: Trips grouped under "Hoy", "Ayer", "Esta semana", "Más antiguo" headers
- **Trip Cards**: White cards with colored left border (teal for ride, orange for food, blue for send), type icon in colored rounded square, type label in matching color, origin→destination with green/red dots, relative timestamp, fare right-aligned, status badge (Completado in green, Cancelado in red)
- **Click Interaction**: Tapping a card triggers a toast with trip summary details
- **Empty State**: Clock icon, "Sin actividad reciente" message with descriptive subtext

### ProfileScreen Details
- **Profile Header**: Teal gradient card with white avatar circle (user initial in teal), user name and email from store, "Ver perfil" link
- **Stats Row**: 3 stats — Viajes (count of completed ride trips from `tripHistory`), Calificación ("4.8" mock), Miembro ("2024" mock), each with colored icon
- **Menu Items**: 6 items in a white card with dividers — Datos personales (teal User), Métodos de pago (purple CreditCard), Direcciones favoritas (orange MapPin), Configuración (gray Settings), Centro de ayuda (sky HelpCircle), Términos y condiciones (gray FileText) — each with colored icon square and chevron, triggers toast on click
- **Danger Zone**: Cambiar rol (violet RefreshCw, navigates to role screen), Cerrar sesión (red LogOut, clears user and navigates to splash)
- **Footer**: "Unira v1.0.0 — Prototipo" in gray

### Design Consistency
- All screens use `#F5F7FA` background, white cards with `rounded-2xl`/`rounded-3xl`, `shadow-sm`, consistent `px-4` padding
- Teal (#0EA5A0) primary accent across all screens
- pb-24 bottom padding for bottom nav clearance
- Mobile-first responsive layout
- Consistent header pattern: back button + icon + title
- All text in Argentine Spanish

### Verification
- ✅ `bun run lint` passes with zero errors/warnings
- ✅ Dev server compiles successfully (Turbopack, no warnings)

---

## [2025-01-XX] Session 7 — Chat, Notifications & Admin Screens

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `src/components/unira/ChatScreen.tsx` | Created | Real-time chat interface with simulated driver replies, quick messages bar, auto-scroll, pre-populated sample messages |
| `src/components/unira/NotificationsScreen.tsx` | Created | Notification center with filter tabs (Todas/Viajes/Promos/Pagos/Sistema), unread indicators, mark-all-as-read, clear-all, type-colored icons |
| `src/components/unira/AdminScreen.tsx` | Created | Driver management panel with stats cards, tab filtering (Pendientes/Aprobados/Rechazados), driver cards with vehicle info, photo placeholders, approve/reject actions |
| `src/app/page.tsx` | Modified | Replaced `chat`, `notifications`, and `admin` placeholder screens with actual `<ChatScreen />`, `<NotificationsScreen />`, and `<AdminScreen />` components; removed unused `MessageCircle` and `Shield` imports |

### ChatScreen Details
- **Header**: Back button, driver avatar (gradient circle with initials "MG"), "Chat con conductor" title, online status badge (green dot), clear chat button (trash icon)
- **Messages Area**: Scrollable flex-grow container with auto-scroll to bottom on new messages. User messages (right-aligned, teal bubble, white text with double-check icon), driver messages (left-aligned, white bubble, dark text). Each message shows text + timestamp via `toLocaleTimeString('es-AR')`. Framer Motion entrance animation per message.
- **Quick Messages Bar**: Horizontal scroll of 5 preset quick messages from `places.ts` ("Estoy llegando", "Esperame un momento", "Ya estoy ahi", "Cancela por favor", "Tengo una bolsa grande"). Each as a teal-outlined rounded chip, tap to send.
- **Input Bar**: Fixed bottom with text input, Enter key support, teal send button (disabled when empty). On send: calls `addChatMessage` with senderId='user', clears input, auto-generates driver reply after 2 seconds (random from quick messages).
- **Pre-population**: 4 sample messages added on first mount (driver greeting, user confirmation, driver ETA, user acknowledgment).
- **Empty State**: MessageCircle icon, "Sin mensajes aún" text.
- **Cleanup**: Proper `setTimeout` cleanup via ref array on unmount.

### NotificationsScreen Details
- **Header**: Back button, "Notificaciones" title, unread count badge, "Marcar todas como leídas" text button (only when unread > 0).
- **Filter Tabs**: Todas / Viajes / Promos / Pagos / Sistema — horizontal scroll with teal active state, rounded pill buttons.
- **Notification Cards**: Each with type-colored icon (trip=teal Car, promo=orange Gift, payment=emerald CreditCard, system=gray Settings), title (bold if unread, medium if read), body text (line-clamp-2), timeAgo timestamp, type label badge. Unread indicator as teal dot on left + subtle ring. Tap marks as read.
- **AnimatePresence**: Smooth exit animations when filtering or clearing.
- **Clear All**: "Borrar todo" red button at bottom with trash icon, sets local `cleared` state to show empty state.
- **Empty State**: Bell icon, contextual message based on active filter tab.

### AdminScreen Details
- **Stats Cards**: Horizontal scroll row of 3 cards — Choferes registrados (12, teal gradient), Viajes hoy (47, orange gradient), Ingresos hoy ($285.400, emerald gradient). Each with gradient icon, value, label.
- **Tab Bar**: 3 tabs (Pendientes/Aprobados/Rechazados) in white card with count badges. Active tab teal with count in white circle.
- **Driver Cards**: Avatar (gradient circle with initials), name, DNI, vehicle info bar (type, brand, model, plate in mono font), 2×2 photo thumbnail grid (colored placeholder squares with Camera icon).
  - **Pendientes**: "Aprobar" (teal, solid) + "Rechazar" (red outline) action buttons. On action: removes card with Framer Motion exit animation, shows toast.
  - **Aprobados**: Green "Aprobado" badge with CheckCircle icon.
  - **Rechazados**: Red "Rechazado" badge with XCircle icon.
- **Mock Data**: 10 drivers total (5 pending, 3 approved, 2 rejected) with realistic Argentine names (Gonzalo Andrés Ruiz, Natalia Soledad Fernández, Martín Ezequiel Torres, Valentina Belén Gutiérrez, Facundo Raúl Medina, etc.), DNI numbers, vehicle types, brands, models, and plates.
- **Empty State**: Users icon, contextual message per tab.

### Technical Details
- **Store integration**: Chat uses `chatMessages`, `addChatMessage`, `clearChat`, `goBack`, `showToast`. Notifications uses `notifications`, `markAsRead`, `goBack`, `showToast`. Admin uses local `useState` for driver list with `goBack`, `showToast`.
- **Framer Motion**: `fadeUp` entrance animations on all sections, `AnimatePresence` with `popLayout` mode for list item removal animations in Admin and filtering in Notifications.
- **Timeout cleanup**: Chat uses `timeoutsRef` array to track and cleanup all `setTimeout` calls on unmount, preventing memory leaks.
- **All text in Argentine Spanish**: "Chat con conductor", "Estoy llegando", "Sin notificaciones", "Marcar todas como leídas", "Borrar todo", "Panel de Administración", "Choferes registrados", "Aprobar", "Rechazar", etc.

### Design Consistency
- All screens use `#F5F7FA` background, white cards with `rounded-2xl`, `shadow-sm`
- Teal (#0EA5A0) primary accent for buttons, badges, active states
- Consistent header pattern: back button (rounded-full gray-50) + title
- pb-24 bottom padding for bottom nav clearance (ChatScreen uses flex-column with no pb-24 since it fills viewport)
- Mobile-first responsive layout
- `hide-scrollbar` on horizontal scroll containers

### Verification
- ✅ `bun run lint` passes with zero errors/warnings
- ✅ Dev server compiles successfully (Turbopack, no warnings)
