'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface DriverLocation {
  driverId: string;
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

/**
 * Hook to connect to the real-time tracking WebSocket service.
 * Falls back to polling if WebSocket is unavailable.
 */
export function useTrackingSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [locations, setLocations] = useState<Map<string, DriverLocation>>(new Map());

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      timeout: 5000,
    });

    socket.on('connect', () => {
      console.log('[tracking] WebSocket connected');
      setConnected(true);
      socket.emit('subscribe:admin', 'dashboard-admin');
    });

    socket.on('disconnect', () => {
      console.log('[tracking] WebSocket disconnected');
      setConnected(false);
    });

    // Receive initial snapshot of all driver locations
    socket.on('locations:snapshot', (snapshot: Record<string, DriverLocation>) => {
      setLocations(new Map(Object.entries(snapshot)));
    });

    // Receive real-time updates
    socket.on('driver:updated', (data: DriverLocation) => {
      setLocations((prev) => {
        const next = new Map(prev);
        next.set(data.driverId, data);
        return next;
      });
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connected, locations, disconnect, reconnect: connect };
}
