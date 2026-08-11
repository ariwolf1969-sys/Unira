import { Server } from 'socket.io';
import { createServer } from 'http';

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = 3003;

// Track connected admins
const connectedAdmins = new Set<string>();

// In-memory driver locations (synced from DB on connect)
// In production, this would be backed by Redis
const driverLocations: Map<
  string,
  {
    lat: number;
    lng: number;
    heading: number;
    speed: number;
    updatedAt: string;
    name: string;
    phone: string;
    vehicleType: string;
    vehiclePlate: string;
    isOnline: boolean;
    currentTripId: string;
  }
> = new Map();

io.on('connection', (socket) => {
  console.log(`[tracking] Client connected: ${socket.id}`);

  // ── Admin subscribes to real-time updates ──
  socket.on('subscribe:admin', (adminId: string) => {
    connectedAdmins.add(socket.id);
    socket.join('admins');
    console.log(`[tracking] Admin ${adminId} subscribed (${connectedAdmins.size} admins)`);

    // Send current state snapshot
    const snapshot = Object.fromEntries(driverLocations);
    socket.emit('locations:snapshot', snapshot);
  });

  // ── Driver updates their location ──
  socket.on('driver:location', (data: {
    driverId: string;
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    name?: string;
    phone?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    isOnline?: boolean;
    currentTripId?: string;
  }) => {
    const entry = {
      lat: data.lat,
      lng: data.lng,
      heading: data.heading || 0,
      speed: data.speed || 0,
      updatedAt: new Date().toISOString(),
      name: data.name || '',
      phone: data.phone || '',
      vehicleType: data.vehicleType || '',
      vehiclePlate: data.vehiclePlate || '',
      isOnline: data.isOnline ?? true,
      currentTripId: data.currentTripId || '',
    };

    driverLocations.set(data.driverId, entry);

    // Broadcast to all connected admins
    io.to('admins').emit('driver:updated', {
      driverId: data.driverId,
      ...entry,
    });
  });

  // ── Driver goes offline ──
  socket.on('driver:offline', (driverId: string) => {
    const entry = driverLocations.get(driverId);
    if (entry) {
      entry.isOnline = false;
      entry.updatedAt = new Date().toISOString();
      io.to('admins').emit('driver:updated', {
        driverId,
        ...entry,
      });
    }
  });

  socket.on('disconnect', () => {
    connectedAdmins.delete(socket.id);
    console.log(`[tracking] Client disconnected: ${socket.id} (${connectedAdmins.size} admins)`);
  });
});

// Health check endpoint
httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', drivers: driverLocations.size, admins: connectedAdmins.size }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

httpServer.listen(PORT, () => {
  console.log(`[tracking] WebSocket service running on port ${PORT}`);
});
