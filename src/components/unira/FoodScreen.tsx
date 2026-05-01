'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore, type Restaurant, type MenuItem } from '@/lib/store';
import { restaurants } from '@/lib/places';
import { formatCurrency, generateId } from '@/lib/utils';
import {
  ArrowLeft,
  Search,
  Star,
  Clock,
  Utensils,
  Plus,
  Minus,
  ShoppingCart,
  ChevronRight,
  X,
  MapPin,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type FoodStep = 'list' | 'detail' | 'cart';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_CHIPS = [
  'Todos',
  'Pizza',
  'Hamburguesas',
  'Empanadas',
  'Sushi',
  'Asiática',
  'Café',
  'Parrilla',
  'Saludable',
  'Milanesas',
];

const CATEGORY_GRADIENTS: Record<string, string> = {
  Empanadas: 'from-orange-400 to-amber-500',
  Parrilla: 'from-red-500 to-rose-600',
  Pizzas: 'from-yellow-400 to-orange-400',
  Sushi: 'from-purple-400 to-indigo-500',
  Café: 'from-amber-600 to-yellow-700',
  Hamburguesas: 'from-orange-500 to-red-500',
  Milanesas: 'from-amber-500 to-orange-500',
  Saludable: 'from-emerald-400 to-green-500',
};

const MENU_ITEM_COLORS: Record<string, string> = {
  Empanadas: 'bg-amber-100',
  Parrilla: 'bg-red-50',
  Pizzas: 'bg-yellow-50',
  Rollos: 'bg-purple-50',
  Nigiri: 'bg-indigo-50',
  Combos: 'bg-violet-50',
  Cocina: 'bg-pink-50',
  Bebidas: 'bg-sky-50',
  Tostados: 'bg-amber-50',
  Facturas: 'bg-orange-50',
  Postres: 'bg-rose-50',
  Hamburguesas: 'bg-orange-100',
  Acompañamientos: 'bg-yellow-50',
  Milanesas: 'bg-amber-50',
  Sándwiches: 'bg-orange-50',
  Pollo: 'bg-yellow-50',
  Bowls: 'bg-green-50',
  Ensaladas: 'bg-emerald-50',
  Wraps: 'bg-lime-50',
  Desayunos: 'bg-teal-50',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function FoodScreen() {
  const store = useAppStore();

  // Step management
  const [step, setStep] = useState<FoodStep>('list');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');

  // Menu category tabs
  const [activeMenuTab, setActiveMenuTab] = useState('');

  // Transition helper
  const transitionTo = useCallback((nextStep: FoodStep) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setIsTransitioning(false);
    }, 200);
  }, []);

  // Filtered restaurants
  const filteredRestaurants = useMemo(() => {
    return restaurants.filter((r) => {
      const matchesSearch =
        searchQuery.length < 2 ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === 'Todos' ||
        r.category.toLowerCase() === activeCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  // Menu categories for selected restaurant
  const menuCategories = useMemo(() => {
    if (!selectedRestaurant) return [];
    const cats = Array.from(new Set(selectedRestaurant.menu.map((m) => m.category)));
    return cats;
  }, [selectedRestaurant]);

  // Set initial menu tab from restaurant
  const activeMenuTabResolved = activeMenuTab || (selectedRestaurant && menuCategories.length > 0 ? menuCategories[0] : '');

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    if (!selectedRestaurant) return [];
    if (!activeMenuTabResolved) return selectedRestaurant.menu;
    return selectedRestaurant.menu.filter((m) => m.category === activeMenuTabResolved);
  }, [selectedRestaurant, activeMenuTabResolved]);

  // Cart helpers
  const cartItemCount = store.cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = store.getCartTotal();

  const getItemQuantity = useCallback(
    (menuItemId: string) => {
      const item = store.cart.find((c) => c.menuItem.id === menuItemId);
      return item?.quantity || 0;
    },
    [store.cart]
  );

  const handleAddToCart = useCallback(
    (menuItem: MenuItem) => {
      if (!selectedRestaurant) return;
      store.addToCart({
        menuItem,
        restaurantId: selectedRestaurant.id,
        restaurantName: selectedRestaurant.name,
        quantity: 1,
      });
    },
    [store, selectedRestaurant]
  );

  const handleDecreaseCart = useCallback(
    (menuItemId: string) => {
      const qty = getItemQuantity(menuItemId);
      if (qty <= 1) {
        store.removeFromCart(menuItemId);
      } else {
        store.updateCartQuantity(menuItemId, qty - 1);
      }
    },
    [getItemQuantity, store]
  );

  // Navigate to restaurant detail
  const openRestaurant = useCallback(
    (restaurant: Restaurant) => {
      setSelectedRestaurant(restaurant);
      transitionTo('detail');
    },
    [transitionTo]
  );

  // Open cart
  const openCart = useCallback(() => {
    transitionTo('cart');
  }, [transitionTo]);

  // Place order
  const handlePlaceOrder = useCallback(() => {
    if (!selectedRestaurant || store.cart.length === 0) return;

    const total = cartTotal + selectedRestaurant.deliveryFee;

    // Add to history
    store.addToHistory({
      id: generateId(),
      type: 'food',
      status: 'completed',
      origin: {
        name: selectedRestaurant.name,
        address: selectedRestaurant.category,
        lat: -34.6037,
        lng: -58.3816,
      },
      destination: {
        name: 'Mi ubicación',
        address: 'Buenos Aires, CABA',
        lat: -34.6037,
        lng: -58.3816,
      },
      fare: total,
      vehicleType: 'moto',
      createdAt: new Date(),
    });

    // Wallet deduction
    store.addMovement({
      id: generateId(),
      type: 'food',
      amount: -total,
      description: `${selectedRestaurant.name} - Delivery`,
      date: new Date().toISOString(),
      balance: store.walletBalance - total,
    });

    // Clear cart
    store.clearCart();
    store.showToast('¡Pedido realizado con éxito! 🎉', 'success');

    // Go home after 2 seconds
    setTimeout(() => {
      store.setCurrentScreen('home');
    }, 2000);
  }, [selectedRestaurant, cartTotal, store]);

  // Go back
  const handleBack = useCallback(() => {
    if (step === 'cart') {
      transitionTo('detail');
    } else if (step === 'detail') {
      transitionTo('list');
    } else {
      store.setCurrentScreen('home');
    }
  }, [step, transitionTo, store]);

  // Go home
  const goHome = useCallback(() => {
    store.clearCart();
    store.setCurrentScreen('home');
  }, [store]);

  return (
    <div className="relative min-h-[100dvh] bg-[#F5F7FA] pb-24 overflow-hidden">
      {/* ═══ Step 1: Restaurant List ═══ */}
      {step === 'list' && (
        <div
          className={`transition-all duration-200 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <button
              onClick={goHome}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-2">
              <Utensils className="w-6 h-6 text-[#FF8C42]" />
              <h1 className="text-xl font-bold text-gray-900">UniraFood</h1>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 mt-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar restaurantes..."
                className="w-full pl-10 pr-4 py-3 bg-white rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#FF8C42]/30 placeholder:text-gray-400 text-gray-800 shadow-sm"
                aria-label="Buscar restaurantes"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category Chips */}
          <div className="mt-3 px-4">
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
              {CATEGORY_CHIPS.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    activeCategory === cat
                      ? 'bg-[#FF8C42] text-white shadow-sm shadow-[#FF8C42]/25'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Restaurant List */}
          <div className="px-4 mt-4 space-y-3 pb-4">
            {filteredRestaurants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Search className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 font-medium">No se encontraron restaurantes</p>
                <p className="text-xs text-gray-400 mt-1">Probá con otra búsqueda o categoría</p>
              </div>
            ) : (
              filteredRestaurants.map((restaurant) => {
                const gradientClass =
                  CATEGORY_GRADIENTS[restaurant.category] || 'from-gray-400 to-gray-500';
                const initial = restaurant.name.charAt(0).toUpperCase();

                return (
                  <button
                    key={restaurant.id}
                    onClick={() => openRestaurant(restaurant)}
                    className="w-full bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md active:scale-[0.98] transition-all text-left"
                  >
                    <div className="flex gap-3 p-3">
                      {/* Image placeholder */}
                      <div
                        className={`w-20 h-20 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0`}
                      >
                        <span className="text-2xl font-bold text-white/90">{initial}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-gray-900 truncate">
                            {restaurant.name}
                          </h3>
                        </div>

                        <span className="inline-block mt-1 text-[10px] font-semibold bg-[#FF8C42]/10 text-[#FF8C42] px-2 py-0.5 rounded-md">
                          {restaurant.category}
                        </span>

                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-xs font-semibold text-gray-700">
                              {restaurant.rating}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs text-gray-500">{restaurant.deliveryTime}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            Envío: {formatCurrency(restaurant.deliveryFee)}
                          </span>
                          <span className="text-xs font-semibold text-[#FF8C42] flex items-center gap-0.5">
                            Ver menú <ChevronRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ═══ Step 2: Restaurant Detail ═══ */}
      {step === 'detail' && selectedRestaurant && (
        <div
          className={`transition-all duration-200 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Header with gradient */}
          <div className="relative">
            <div
              className={`h-44 bg-gradient-to-br ${
                CATEGORY_GRADIENTS[selectedRestaurant.category] || 'from-gray-400 to-gray-500'
              }`}
            >
              <div className="absolute inset-0 bg-black/20" />
              {/* Back button */}
              <button
                onClick={handleBack}
                className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white active:scale-95 transition-all shadow-sm"
                aria-label="Volver"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            {/* Restaurant name overlay */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
              <h2 className="text-xl font-bold text-white drop-shadow-md">
                {selectedRestaurant.name}
              </h2>
              <p className="text-sm text-white/80 mt-0.5">{selectedRestaurant.category}</p>
            </div>
          </div>

          {/* Restaurant info card */}
          <div className="mx-4 -mt-3 bg-white rounded-2xl shadow-lg p-4 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-bold text-gray-900">
                    {selectedRestaurant.rating}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {selectedRestaurant.deliveryTime}
                  </span>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-700">
                Envío: {formatCurrency(selectedRestaurant.deliveryFee)}
              </span>
            </div>
          </div>

          {/* Menu category tabs */}
          {menuCategories.length > 1 && (
            <div className="mt-4 px-4">
              <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
                {menuCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveMenuTab(cat)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      activeMenuTab === cat
                        ? 'bg-[#FF8C42] text-white shadow-sm shadow-[#FF8C42]/25'
                        : 'bg-white text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Menu items */}
          <div className="px-4 mt-3 space-y-3 pb-28">
            {filteredMenuItems.map((item) => {
              const qty = getItemQuantity(item.id);
              const colorClass = MENU_ITEM_COLORS[item.category] || 'bg-gray-50';
              const initial = item.name.charAt(0).toUpperCase();

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-sm p-3 flex gap-3"
                >
                  {/* Image placeholder */}
                  <div
                    className={`w-20 h-20 rounded-xl ${colorClass} flex items-center justify-center flex-shrink-0`}
                  >
                    <span className="text-2xl font-bold text-gray-400/70">{initial}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{item.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                    <p className="text-sm font-bold text-[#FF8C42] mt-1.5">
                      {formatCurrency(item.price)}
                    </p>
                  </div>

                  {/* Add to cart / quantity controls */}
                  <div className="flex flex-col items-center justify-center flex-shrink-0">
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="w-9 h-9 rounded-full bg-[#FF8C42] text-white flex items-center justify-center shadow-sm shadow-[#FF8C42]/25 hover:bg-[#e67e3a] active:scale-90 transition-all"
                        aria-label="Agregar al carrito"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecreaseCart(item.id)}
                          className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-gray-900 w-5 text-center">
                          {qty}
                        </span>
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="w-8 h-8 rounded-full bg-[#FF8C42] text-white flex items-center justify-center hover:bg-[#e67e3a] active:scale-90 transition-all"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating cart button */}
          {cartItemCount > 0 && (
            <div className="fixed bottom-20 left-4 right-4 z-40 max-w-[430px] mx-auto">
              <button
                onClick={openCart}
                className="w-full py-3.5 rounded-2xl bg-[#FF8C42] text-white font-bold shadow-lg shadow-[#FF8C42]/30 hover:bg-[#e67e3a] active:scale-[0.98] transition-all flex items-center justify-between px-5"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  <span>{cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}</span>
                </div>
                <span className="text-lg">{formatCurrency(cartTotal + selectedRestaurant.deliveryFee)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ Step 3: Cart ═══ */}
      {step === 'cart' && selectedRestaurant && (
        <div
          className={`transition-all duration-200 ${
            isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <button
              onClick={handleBack}
              className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">Tu pedido</h1>
          </div>

          {store.cart.length === 0 ? (
            /* Empty cart */
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <ShoppingCart className="w-9 h-9 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Carrito vacío</h3>
              <p className="text-sm text-gray-500 text-center">
                No tenés items en tu carrito. Añadí algo del menú para empezar.
              </p>
              <button
                onClick={handleBack}
                className="mt-6 px-6 py-3 rounded-2xl bg-[#FF8C42] text-white font-semibold text-sm shadow-sm shadow-[#FF8C42]/25 hover:bg-[#e67e3a] active:scale-95 transition-all"
              >
                Ver menú
              </button>
            </div>
          ) : (
            <div className="px-4 mt-2">
              {/* Restaurant name */}
              <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${
                    CATEGORY_GRADIENTS[selectedRestaurant.category] || 'from-gray-400 to-gray-500'
                  } flex items-center justify-center`}
                >
                  <span className="text-sm font-bold text-white">
                    {selectedRestaurant.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedRestaurant.name}</p>
                  <p className="text-xs text-gray-500">{selectedRestaurant.category}</p>
                </div>
              </div>

              {/* Cart items */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto hide-scrollbar">
                {store.cart.map((item) => (
                  <div
                    key={item.menuItem.id}
                    className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {item.menuItem.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatCurrency(item.menuItem.price)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDecreaseCart(item.menuItem.id)}
                        className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 active:scale-90 transition-all"
                        aria-label="Disminuir"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold text-gray-900 w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleAddToCart(item.menuItem)}
                        className="w-8 h-8 rounded-full bg-[#FF8C42] text-white flex items-center justify-center hover:bg-[#e67e3a] active:scale-90 transition-all"
                        aria-label="Aumentar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-16 text-right flex-shrink-0">
                      {formatCurrency(item.menuItem.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price breakdown */}
              <div className="bg-white rounded-2xl p-4 shadow-sm mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Subtotal</span>
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Envío</span>
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrency(selectedRestaurant.deliveryFee)}
                    </span>
                  </div>
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-gray-900">Total</span>
                      <span className="text-lg font-bold text-[#FF8C42]">
                        {formatCurrency(cartTotal + selectedRestaurant.deliveryFee)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Place order button */}
              <div className="mt-6 pb-4">
                <button
                  onClick={handlePlaceOrder}
                  className="w-full py-4 rounded-2xl bg-[#FF8C42] text-white font-bold text-base shadow-lg shadow-[#FF8C42]/25 hover:bg-[#e67e3a] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Realizar pedido
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
