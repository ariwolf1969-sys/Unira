import type { Place, Restaurant, MenuItem } from './store';

// ─── 40 Buenos Aires Places ─────────────────────────────────────────────────

export const places: Place[] = [
  { name: 'Obelisco', address: 'Av. 9 de Julio, C1073 CABA', lat: -34.6037, lng: -58.3816 },
  { name: 'Casa Rosada', address: 'Balcarce 50, C1064 CABA', lat: -34.6081, lng: -58.3724 },
  { name: 'Teatro Colón', address: 'Tucumán 1171, C1049 CABA', lat: -34.5997, lng: -58.3734 },
  { name: 'Recoleta Cemetery', address: 'Junín 1760, C1026 CABA', lat: -34.5844, lng: -58.3923 },
  { name: 'Caminito', address: 'Caminito, La Boca, C1161 CABA', lat: -34.6345, lng: -58.3631 },
  { name: 'Puerto Madero', address: 'Av. Alicia Moreau de Justo, C1107 CABA', lat: -34.6172, lng: -58.3639 },
  { name: 'Palermo Soho', address: 'Av. Coronel Díaz, C1425 CABA', lat: -34.5873, lng: -58.4166 },
  { name: 'Plaza de Mayo', address: 'Hipólito Yrigoyen, C1086 CABA', lat: -34.6083, lng: -58.3712 },
  { name: 'MALBA', address: 'Av. Figueroa Alcorta 3415, C1425 CABA', lat: -34.5774, lng: -58.4095 },
  { name: 'Bosques de Palermo', address: 'Av. Figueroa Alcorta, C1425 CABA', lat: -34.5722, lng: -58.4133 },
  { name: 'Florida Street', address: 'Calle Florida, C1005 CABA', lat: -34.6044, lng: -58.3743 },
  { name: 'San Telmo Market', address: 'Defensa 1094, C1065 CABA', lat: -34.6216, lng: -58.3744 },
  { name: 'Planetario', address: 'Av. Benavídez 4617, C1425 CABA', lat: -34.5731, lng: -58.4214 },
  { name: 'Jardín Botánico', address: 'Av. Santa Fe 3951, C1425 CABA', lat: -34.5848, lng: -58.4168 },
  { name: 'Torre Monumental', address: 'Av. Libertador 106, C1002 CABA', lat: -34.6017, lng: -58.3714 },
  { name: 'Congreso de la Nación', address: 'Av. Entre Ríos 51, C1073 CABA', lat: -34.6098, lng: -58.3887 },
  { name: 'Ecobici Estación Microcentro', address: 'Av. Corrientes 1000, C1043 CABA', lat: -34.6034, lng: -58.3806 },
  { name: 'El Ateneo Grand Splendid', address: 'Av. Santa Fe 1860, C1123 CABA', lat: -34.6033, lng: -58.3918 },
  { name: 'Plaza Serrano', address: 'Honduras 4000, C1425 CABA', lat: -34.5884, lng: -58.4276 },
  { name: 'Paseo La Imprenta', address: 'Av. Caseros 3500, C1245 CABA', lat: -34.6274, lng: -58.3878 },
  { name: 'Estación Retiro', address: 'Ramos Mejía 1408, C1073 CABA', lat: -34.6042, lng: -58.3747 },
  { name: 'Costanera Sur', address: 'Av. Tristán Achával Rodríguez, C1107 CABA', lat: -34.6217, lng: -58.3531 },
  { name: 'Barrio Norte', address: 'Av. Córdoba 1700, C1011 CABA', lat: -34.6038, lng: -58.3858 },
  { name: 'Abasto Shopping', address: 'Av. Corrientes 3247, C1193 CABA', lat: -34.6031, lng: -58.4051 },
  { name: 'Dot Baires Shopping', address: 'Av. Coronel Díaz 2811, C1425 CABA', lat: -34.5836, lng: -58.4142 },
  { name: 'Tecnópolis', address: 'Av. General Paz 4750, C1437 CABA', lat: -34.5544, lng: -58.4967 },
  { name: 'Reserva Ecológica', address: 'Av. Tristán Achával Rodríguez 1550, C1107 CABA', lat: -34.6163, lng: -58.3503 },
  { name: 'Pasaje Güemes', address: 'Florida 165, C1005 CABA', lat: -34.6061, lng: -58.3752 },
  { name: 'Paseo del Bajo', address: 'Av. Antártida Argentina, C1107 CABA', lat: -34.6126, lng: -58.3671 },
  { name: 'Mercado de Pulgas Dorrego', address: 'Dorrego 3020, C1425 CABA', lat: -34.5904, lng: -58.4311 },
  { name: 'Usina del Arte', address: 'Agustín R. Caffarena 1, C1155 CABA', lat: -34.6232, lng: -58.3664 },
  { name: 'Floralis Genérica', address: 'Plaza Naciones Unidas, C1425 CABA', lat: -34.5815, lng: -58.4089 },
  { name: 'Plaza Italia', address: 'Av. Santa Fe 4800, C1425 CABA', lat: -34.5881, lng: -58.4291 },
  { name: 'Club Atlético River Plate', address: 'Av. Presidente Figueroa Alcorta 7597, C1424 CABA', lat: -34.5546, lng: -58.4497 },
  { name: 'La Bombonera', address: 'Brandsen 805, C1161 CABA', lat: -34.6353, lng: -58.3682 },
  { name: 'Café Tortoni', address: 'Av. de Mayo 825, C1084 CABA', lat: -34.6088, lng: -58.3844 },
  { name: 'Librería El Ateneo', address: 'Av. Santa Fe 1860, C1123 CABA', lat: -34.6033, lng: -58.3918 },
  { name: 'Zoológico de Buenos Aires', address: 'Av. Sarmiento y Las Heras, C1425 CABA', lat: -34.5819, lng: -58.4244 },
  { name: 'Parque Centenario', address: 'Av. Ángel Gallardo 1800, C1414 CABA', lat: -34.6083, lng: -58.4317 },
  { name: 'Lezama Park', address: 'Defensa 1800, C1141 CABA', lat: -34.6278, lng: -58.3782 },
  { name: 'Ciudad Cultural Konex', address: 'Sarmiento 3131, C1196 CABA', lat: -34.6020, lng: -58.4073 },
];

// ─── Vehicle Types ──────────────────────────────────────────────────────────

export const vehicleTypes = [
  {
    id: 'moto',
    name: 'UniraMoto',
    description: 'Llegá más rápido en moto',
    icon: 'Bike',
    basePrice: 350,
    perKm: 80,
    perMin: 5,
  },
  {
    id: 'auto',
    name: 'UniraAuto',
    description: 'Viaje cómodo y seguro',
    icon: 'Car',
    basePrice: 500,
    perKm: 120,
    perMin: 8,
  },
  {
    id: 'auto_premium',
    name: 'UniraPremium',
    description: 'La mejor experiencia',
    icon: 'Crown',
    basePrice: 900,
    perKm: 180,
    perMin: 12,
  },
  {
    id: 'taxi',
    name: 'UniraTaxi',
    description: 'Taxi con habilitación',
    icon: 'CarFront',
    basePrice: 600,
    perKm: 140,
    perMin: 10,
  },
];

// ─── Restaurants (Argentine food theme) ──────────────────────────────────────

const empanadasMenu: MenuItem[] = [
  { id: 'emp-carne', name: 'Empanada de Carne', description: 'Carne cortada a cuchillo, cebolla, huevo, aceituna', price: 350, image: '/food/empanada-carne.jpg', category: 'Empanadas' },
  { id: 'emp-jamon', name: 'Empanada de Jamón y Queso', description: 'Jamón cocido, queso mozzarella', price: 320, image: '/food/empanada-jamon.jpg', category: 'Empanadas' },
  { id: 'emp-humita', name: 'Empanada de Humita', description: 'Choclo rallado, salsa blanca, queso', price: 300, image: '/food/empanada-humita.jpg', category: 'Empanadas' },
  { id: 'emp-pollo', name: 'Empanada de Pollo', description: 'Pollo desmechado, cebolla, morrón', price: 340, image: '/food/empanada-pollo.jpg', category: 'Empanadas' },
  { id: 'emp-caprese', name: 'Empanada Caprese', description: 'Tomate, queso, albahaca fresca', price: 330, image: '/food/empanada-caprese.jpg', category: 'Empanadas' },
  { id: 'emp-vegana', name: 'Empanada Vegana', description: 'Calabaza, cebolla, comino, tomate seco', price: 350, image: '/food/empanada-vegana.jpg', category: 'Empanadas' },
];

const asadoMenu: MenuItem[] = [
  { id: 'asad-entraña', name: 'Entraña a la Parrilla', description: 'Entraña fina con chimichurri casero, 350g', price: 4800, image: '/food/entrana.jpg', category: 'Parrilla' },
  { id: 'asad-vacio', name: 'Vacío', description: 'Vacío con grela, 400g', price: 5200, image: '/food/vacio.jpg', category: 'Parrilla' },
  { id: 'asad-chori', name: 'Chorizo Parrillero', description: 'Chorizo cerdo a la brasa con pan francés', price: 2800, image: '/food/choripan.jpg', category: 'Parrilla' },
  { id: 'asad-morcilla', name: 'Morcilla Asada', description: 'Morcilla blood sausage, 2 unidades', price: 2200, image: '/food/morcilla.jpg', category: 'Parrilla' },
  { id: 'asad-molleja', name: 'Mollejas', description: 'Mollejas de ternera a la parrilla, 300g', price: 4500, image: '/food/molleja.jpg', category: 'Parrilla' },
  { id: 'asad-tira', name: 'Tira de Asado', description: 'Costillar de novillito, 500g', price: 5000, image: '/food/tira-asado.jpg', category: 'Parrilla' },
];

const pizzaMenu: MenuItem[] = [
  { id: 'pizz-muzza', name: 'Muzzarella Clásica', description: 'Salsa de tomate, muzzarella, aceitunas', price: 4200, image: '/food/muzzarella.jpg', category: 'Pizzas' },
  { id: 'pizz-fugazza', name: 'Fugazza', description: 'Cebolla, tomillo, aceite de oliva', price: 3800, image: '/food/fugazza.jpg', category: 'Pizzas' },
  { id: 'pizz-napolitana', name: 'Napolitana', description: 'Muzzarella, rodajas de tomate, ajo, perejil', price: 4800, image: '/food/napolitana.jpg', category: 'Pizzas' },
  { id: 'pizz-calabresa', name: 'Calabresa', description: 'Longaniza calabresa, muzzarella, morrón', price: 5200, image: '/food/calabresa.jpg', category: 'Pizzas' },
  { id: 'pizz-4quesos', name: 'Cuatro Quesos', description: 'Muzzarella, roquefort, parmesano, provolone', price: 5500, image: '/food/4quesos.jpg', category: 'Pizzas' },
  { id: 'pizz-fugazzeta', name: 'Fugazzeta Rellena', description: 'Masa rellena de muzzarella y cebolla caramelizada', price: 5800, image: '/food/fugazzeta.jpg', category: 'Pizzas' },
];

const sushiMenu: MenuItem[] = [
  { id: 'sushi-california', name: 'California Roll (12 pcs)', description: 'Cangrejo, palta, pepino, sésamo', price: 4500, image: '/food/california.jpg', category: 'Rollos' },
  { id: 'sushi-salmon', name: 'Salmon Roll (12 pcs)', description: 'Salmón fresco, cream cheese, palta', price: 5200, image: '/food/salmon-roll.jpg', category: 'Rollos' },
  { id: 'sushi-tempura', name: 'Tempura Roll (12 pcs)', description: 'Langostino tempura, mayo spicy, palta', price: 5800, image: '/food/tempura-roll.jpg', category: 'Rollos' },
  { id: 'sushi-nigiri', name: 'Nigiri Mix (8 pcs)', description: 'Selección de 4 variedades de nigiri', price: 6200, image: '/food/nigiri.jpg', category: 'Nigiri' },
  { id: 'sushi-combo40', name: 'Combo 40 Piezas', description: 'Selección variada de rolls, nigiri y sashimi', price: 12000, image: '/food/combo40.jpg', category: 'Combos' },
  { id: 'sushi-wok', name: 'Wok de Vegetales', description: 'Vegetales salteados con salsa teriyaki', price: 4800, image: '/food/wok-veggies.jpg', category: 'Cocina' },
];

const cafeMenu: MenuItem[] = [
  { id: 'cafe-submarino', name: 'Submarino', description: 'Barra de chocolate con leche caliente', price: 1800, image: '/food/submarino.jpg', category: 'Bebidas' },
  { id: 'cafe-cortado', name: 'Cortado', description: 'Café espresso con un chorrito de leche', price: 1200, image: '/food/cortado.jpg', category: 'Bebidas' },
  { id: 'cafe-tostado', name: 'Tostado de Jamón y Queso', description: 'Pan brioche, jamón cocido, queso provolone', price: 2800, image: '/food/tostado.jpg', category: 'Tostados' },
  { id: 'cafe-medialuna', name: 'Medialunas (6 uds)', description: 'Medialunas de manteca recién horneadas', price: 2400, image: '/food/medialunas.jpg', category: 'Facturas' },
  { id: 'cafe-chocotorta', name: 'Chocotorta', description: 'Chocolinas, dulce de leche, queso crema', price: 3200, image: '/food/chocotorta.jpg', category: 'Postres' },
  { id: 'cafe-latte', name: 'Café Latte', description: 'Doble espresso con leche vaporizada', price: 2000, image: '/food/latte.jpg', category: 'Bebidas' },
];

const burgerMenu: MenuItem[] = [
  { id: 'burg-clasica', name: 'Hamburguesa Clásica', description: 'Medallón 150g, lechuga, tomate, cebolla, salsa especial', price: 3800, image: '/food/burg-clasica.jpg', category: 'Hamburguesas' },
  { id: 'burg-doble', name: 'Doble Smash', description: '2 medallones smash 100g, cheddar, bacon, pickles', price: 5200, image: '/food/burg-doble.jpg', category: 'Hamburguesas' },
  { id: 'burg-pollo', name: 'Chicken Burger', description: 'Pollo crispy, slaw de repollo, salsa honey mustard', price: 4200, image: '/food/burg-pollo.jpg', category: 'Hamburguesas' },
  { id: 'burg-papas', name: 'Papas Fritas', description: 'Papas fritas crocantes con sal fina', price: 1800, image: '/food/papas.jpg', category: 'Acompañamientos' },
  { id: 'burg-onion', name: 'Aros de Cebolla', description: 'Aros de cebolla rebozados, salsa BBQ', price: 2200, image: '/food/onion-rings.jpg', category: 'Acompañamientos' },
  { id: 'burg-milkshake', name: 'Milkshake', description: 'Vainilla, chocolate o dulce de leche con crema', price: 2500, image: '/food/milkshake.jpg', category: 'Bebidas' },
];

const milangaMenu: MenuItem[] = [
  { id: 'mil-clasica', name: 'Milanesa de Carne', description: 'Milanesa de ternera 200g con papas fritas', price: 4500, image: '/food/milanesa-carne.jpg', category: 'Milanesas' },
  { id: 'mil-pollo', name: 'Milanesa de Pollo', description: 'Milanesa de pollo 200g con ensalada mixta', price: 4200, image: '/food/milanesa-pollo.jpg', category: 'Milanesas' },
  { id: 'mil-napolitana', name: 'Milanesa Napolitana', description: 'Milanesa con jamón, queso gratinado y salsa de tomate', price: 5200, image: '/food/milanesa-napo.jpg', category: 'Milanesas' },
  { id: 'mil-completa', name: 'Milanesa Completa', description: 'Milanesa, huevo frito, jamón, queso, lechuga, tomate', price: 5800, image: '/food/milanesa-completa.jpg', category: 'Milanesas' },
  { id: 'mil-sandwich', name: 'Sándwich de Milanesa', description: 'Milanesa en pan francés, lechuga, tomate, mayo', price: 3500, image: '/food/sandwich-milanga.jpg', category: 'Sándwiches' },
  { id: 'mil-papas-sup', name: 'Suprema de Pollo', description: 'Suprema empanizada con puré de papas', price: 4800, image: '/food/suprema.jpg', category: 'Pollo' },
];

const healthyMenu: MenuItem[] = [
  { id: 'hlthy-bowl', name: 'Buddha Bowl', description: 'Quinoa, garbanzos, palta, hummus, vegetales asados', price: 4500, image: '/food/buddha-bowl.jpg', category: 'Bowls' },
  { id: 'hlthy-salad', name: 'Ensalada César', description: 'Lechuga romana, pollo grillado, parmesano, croutons', price: 3800, image: '/food/cesar.jpg', category: 'Ensaladas' },
  { id: 'hlthy-wrap', name: 'Wrap de Pollo', description: 'Tortilla integral, pollo, palta, tomate, rúcula', price: 3500, image: '/food/wrap-pollo.jpg', category: 'Wraps' },
  { id: 'hlthy-aco', name: 'Açaí Bowl', description: 'Açaí, banana, granola, frutos rojos, miel', price: 4000, image: '/food/acai-bowl.jpg', category: 'Bowls' },
  { id: 'hlthy-green', name: 'Green Smoothie', description: 'Espinaca, banana, mango, jengibre, leche de almendras', price: 2800, image: '/food/green-smoothie.jpg', category: 'Bebidas' },
  { id: 'hlthy-toast', name: 'Avocado Toast', description: 'Pan de masa madre, palta, huevo pochado, semillas', price: 3800, image: '/food/avocado-toast.jpg', category: 'Desayunos' },
];

export const restaurants: Restaurant[] = [
  {
    id: 'rest-empanadas',
    name: 'Empanadas de la Abuela',
    image: '/restaurants/empanadas.jpg',
    rating: 4.8,
    deliveryTime: '25-35 min',
    deliveryFee: 200,
    category: 'Empanadas',
    menu: empanadasMenu,
  },
  {
    id: 'rest-asado',
    name: 'Parrilla La Porteña',
    image: '/restaurants/parrilla.jpg',
    rating: 4.6,
    deliveryTime: '40-55 min',
    deliveryFee: 350,
    category: 'Parrilla',
    menu: asadoMenu,
  },
  {
    id: 'rest-pizza',
    name: 'Pizzería El Griego',
    image: '/restaurants/pizzeria.jpg',
    rating: 4.5,
    deliveryTime: '30-40 min',
    deliveryFee: 250,
    category: 'Pizzas',
    menu: pizzaMenu,
  },
  {
    id: 'rest-sushi',
    name: 'Osaka Sushi Bar',
    image: '/restaurants/sushi.jpg',
    rating: 4.7,
    deliveryTime: '35-50 min',
    deliveryFee: 400,
    category: 'Sushi',
    menu: sushiMenu,
  },
  {
    id: 'rest-cafe',
    name: 'Café Tortoni Delivery',
    image: '/restaurants/cafe.jpg',
    rating: 4.9,
    deliveryTime: '20-30 min',
    deliveryFee: 150,
    category: 'Café',
    menu: cafeMenu,
  },
  {
    id: 'rest-burger',
    name: 'Smash Burgers BA',
    image: '/restaurants/burger.jpg',
    rating: 4.4,
    deliveryTime: '25-35 min',
    deliveryFee: 200,
    category: 'Hamburguesas',
    menu: burgerMenu,
  },
  {
    id: 'rest-milanga',
    name: 'Milanga Club',
    image: '/restaurants/milanga.jpg',
    rating: 4.3,
    deliveryTime: '30-45 min',
    deliveryFee: 250,
    category: 'Milanesas',
    menu: milangaMenu,
  },
  {
    id: 'rest-healthy',
    name: 'Green Life Bowls',
    image: '/restaurants/healthy.jpg',
    rating: 4.6,
    deliveryTime: '20-30 min',
    deliveryFee: 200,
    category: 'Saludable',
    menu: healthyMenu,
  },
];

// ─── Quick Messages for Chat ────────────────────────────────────────────────

export const quickMessages = [
  'Estoy llegando',
  'Esperame un momento',
  'Ya estoy ahi',
  'Cancela por favor',
  'Tengo una bolsa grande',
];

// ─── Promotions ─────────────────────────────────────────────────────────────

export const promotions = [
  {
    id: 'promo-welcome',
    title: '¡Bienvenido a Unira!',
    description: 'Tu primer viaje gratis hasta $2.000. Usá el código BIENVENIDO al pagar.',
    code: 'BIENVENIDO',
    discount: 2000,
    minRide: 0,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    icon: 'Gift',
    color: '#0EA5A0',
  },
  {
    id: 'promo-food50',
    title: '50% en tu primer delivery',
    description: 'Pedí cualquier restaurante y obtené 50% de descuento en tu primer pedido de comida.',
    code: 'FOOD50',
    discount: 50,
    minRide: 0,
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    icon: 'Utensils',
    color: '#F59E0B',
  },
  {
    id: 'promo-weekend',
    title: '2x1 en viajes el finde',
    description: 'Cada viaje que hagas el fin de semana te da un crédito del mismo monto para el próximo.',
    code: 'WEEKEND',
    discount: 100,
    minRide: 1000,
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    icon: 'CalendarDays',
    color: '#8B5CF6',
  },
  {
    id: 'promo-refer',
    title: 'Invitá amigos, ganá $1.000',
    description: 'Por cada amigo que se registre con tu link y haga un viaje, ambos reciben $1.000 de crédito.',
    code: null,
    discount: 1000,
    minRide: 0,
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    icon: 'Users',
    color: '#EC4899',
  },
];
