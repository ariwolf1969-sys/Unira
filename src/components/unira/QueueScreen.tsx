'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
  ArrowLeft, MapPin, Clock, Users, ChevronRight, 
  RefreshCw, Leave, CircleDot, Hash,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface QueueLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
  maxQueueSize: number;
}

interface QueueEntry {
  id: string;
  position: number;
  driverName: string;
  locationName: string;
  joinedAt: string;
  estimatedWaitMinutes: number;
  status: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QueueScreen() {
  const store = useAppStore();
  const [locations, setLocations] = useState<QueueLocation[]>([]);
  const [myQueues, setMyQueues] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<QueueLocation | null>(null);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [joining, setJoining] = useState(false);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch('/api/pois?type=queue');
      if (res.ok) {
        const data = await res.json();
        // Filter active queue locations
        const queueLocs = (data.pois || []).filter((p: any) => p.type === 'queue' && p.isActive);
        setLocations(queueLocs.map((p: any) => ({
          id: p.id, name: p.name, address: p.address || '',
          lat: p.lat, lng: p.lng, radiusMeters: p.radiusMeters || 500,
          isActive: p.isActive, maxQueueSize: p.maxQueueSize || 50,
        })));
      }
    } catch (err) {
      console.warn('[queue] fetch locations failed', err);
    }
  }, []);

  const fetchMyQueues = useCallback(async () => {
    if (!store.user) return;
    try {
      const res = await fetch(`/api/drivers/${store.user.uid}/queue`);
      if (res.ok) {
        const data = await res.json();
        setMyQueues(data.entries || []);
      }
    } catch { /* no queue endpoint yet, use empty */ }
  }, [store.user]);

  const fetchQueueEntries = useCallback(async (locationId: string) => {
    try {
      const res = await fetch(`/api/pois/${locationId}/queue`);
      if (res.ok) {
        const data = await res.json();
        setQueueEntries(data.entries || []);
      }
    } catch { /* empty */ }
  }, []);

  useEffect(() => {
    fetchLocations();
    fetchMyQueues();
  }, [fetchLocations, fetchMyQueues]);

  const handleJoinQueue = async (location: QueueLocation) => {
    if (!store.user || joining) return;
    setJoining(true);
    try {
      const res = await fetch('/api/pois', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: store.user.uid,
          driverName: store.user.name,
          locationId: location.id,
          action: 'join_queue',
        }),
      });
      if (res.ok) {
        store.showToast(`Te uniste a la fila de ${location.name}`, 'success');
        fetchMyQueues();
        if (selectedLocation?.id === location.id) fetchQueueEntries(location.id);
      } else {
        store.showToast('No se pudo unir a la fila', 'error');
      }
    } catch {
      store.showToast('Error de conexion', 'error');
    } finally { setJoining(false); }
  };

  const handleLeaveQueue = async (entryId: string) => {
    if (!store.user) return;
    try {
      const res = await fetch('/api/pois', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, action: 'leave_queue' }),
      });
      if (res.ok) {
        store.showToast('Saliste de la fila', 'info');
        fetchMyQueues();
        if (selectedLocation) fetchQueueEntries(selectedLocation.id);
      }
    } catch { /* silent */ }
  };

  const handleSelectLocation = (loc: QueueLocation) => {
    setSelectedLocation(loc);
    fetchQueueEntries(loc.id);
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F5F7FA]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 bg-white shadow-sm sticky top-0 z-10">
        <button
          onClick={() => store.setCurrentScreen('driver')}
          className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all"
          aria-label="Volver"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Filas virtuales</h1>
            <p className="text-[11px] text-gray-500 leading-tight">Unite a filas en puntos clave</p>
          </div>
        </div>
        <button onClick={() => { fetchLocations(); fetchMyQueues(); }} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100">
          <RefreshCw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4">
        {/* My active queues */}
        {myQueues.length > 0 && (
          <div>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tus filas activas</h2>
            <div className="space-y-2">
              {myQueues.filter(q => q.status === 'waiting').map((entry) => (
                <div key={entry.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Hash className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{entry.locationName}</p>
                    <p className="text-xs text-gray-500">
                      Posicion #{entry.position} · ~{entry.estimatedWaitMinutes} min espera
                    </p>
                  </div>
                  <button
                    onClick={() => handleLeaveQueue(entry.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 active:scale-95 transition-all"
                  >
                    Salir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected queue detail */}
        {selectedLocation ? (
          <div>
            <button onClick={() => setSelectedLocation(null)} className="text-xs text-[#0EA5A0] font-semibold mb-2 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Volver a ubicaciones
            </button>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">{selectedLocation.name}</h3>
              </div>
              {queueEntries.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay conductores en esta fila</p>
              ) : (
                <div className="space-y-1.5">
                  {queueEntries.map((entry, i) => (
                    <div key={entry.id} className={`flex items-center gap-3 p-2 rounded-xl ${i === 0 ? 'bg-emerald-50 border border-emerald-100' : ''}`}>
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>#{entry.position}</span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-800">{entry.driverName}</p>
                        <p className="text-[10px] text-gray-400">~{entry.estimatedWaitMinutes} min</p>
                      </div>
                      {i === 0 && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">PROXIMO</span>}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleJoinQueue(selectedLocation)}
                disabled={joining || myQueues.some(q => q.locationName === selectedLocation.name)}
                className="w-full mt-3 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {joining ? 'Uniendose...' : myQueues.some(q => q.locationName === selectedLocation.name) ? 'Ya estas en esta fila' : 'Unirme a esta fila'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Puntos de fila disponibles</h2>
            {locations.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No hay filas disponibles</p>
                <p className="text-xs text-gray-300 mt-1">Se habilitaran en aeropuertos y terminales</p>
              </div>
            ) : (
              <div className="space-y-2">
                {locations.map((loc) => (
                  <button
                    key={loc.id}
                    onClick={() => handleSelectLocation(loc)}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md active:scale-[0.99] transition-all text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{loc.name}</p>
                      <p className="text-xs text-gray-500 truncate">{loc.address}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
