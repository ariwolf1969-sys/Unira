'use client';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { ArrowLeft, Search, Star, Phone, ChevronRight } from 'lucide-react';
const categories = [
  { id:'electricidad', name:'Electricidad', icon:'⚡', color:'#F59E0B', bg:'#FFFBEB' },
  { id:'plomeria', name:'Plomeria', icon:'💧', color:'#3B82F6', bg:'#EFF6FF' },
  { id:'limpieza', name:'Limpieza', icon:'✨', color:'#10B981', bg:'#ECFDF5' },
  { id:'cerrajeria', name:'Cerrajeria', icon:'🔑', color:'#8B5CF6', bg:'#F5F3FF' },
  { id:'pintura', name:'Pintura', icon:'🎨', color:'#EF4444', bg:'#FEF2F2' },
  { id:'gas', name:'Gasista', icon:'🔥', color:'#F97316', bg:'#FFF7ED' }
];
const providers = [
  { id:1, name:'Carlos Electricista', cat:'electricidad', rating:4.9, jobs:234, price:'$3500/h' },
  { id:2, name:'Martin Gasista', cat:'gas', rating:4.8, jobs:156, price:'$4000/h' },
  { id:3, name:'Ana Limpieza Pro', cat:'limpieza', rating:5.0, jobs:312, price:'$2500/h' },
  { id:4, name:'Pedro Plomero', cat:'plomeria', rating:4.7, jobs:189, price:'$3800/h' },
  { id:5, name:'Laura Cerrajera', cat:'cerrajeria', rating:4.9, jobs:98, price:'$5000/visita' },
  { id:6, name:'Raul Pintor', cat:'pintura', rating:4.6, jobs:145, price:'$3000/h' }
];
export function ServicesScreen() {
  const { goBack } = useAppStore();
  const [selCat, setSelCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const filtered = selCat ? providers.filter(p=>p.cat===selCat) : providers;
  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 pt-6">
        <div className="flex items-center gap-3 mb-3"><button onClick={goBack}><span className="text-xl">{'<'}</span></button><h1 className="text-xl font-bold">UniraServicios</h1></div>
        <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar servicio o profesional" className="bg-transparent text-white placeholder-white/70 text-sm outline-none flex-1"/></div>
      </div>
      <div className="p-4 space-y-4">

        {selCat && <button onClick={() => setSelCat(null)} className="text-sm text-purple-600 font-medium">Ver todas las categorias</button>}
        {!selCat && (
          <div className="grid grid-cols-3 gap-3">
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelCat(c.id)} className="bg-white rounded-xl p-3 text-center shadow-sm border active:scale-95 transition-all">
                <span className="text-2xl block mb-1">{c.icon}</span>
                <p className="text-xs font-medium text-gray-700">{c.name}</p>
              </button>
            ))}
          </div>
        )}
        <h2 className="font-bold text-gray-800">{selCat ? categories.find(c=>c.id===selCat)?.name : 'Profesionales destacados'}</h2>
        <div className="space-y-3">
          {filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => (
            <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-lg font-bold">{p.name.split(' ')[0][0]}{p.name.split(' ')[1]?.[0]||''}</div>
                <div><p className="font-medium text-gray-800 text-sm">{p.name}</p><div className="flex items-center gap-2 mt-0.5"><Star size={12} className="text-amber-400 fill-amber-400"/><span className="text-xs text-gray-500">{p.rating} ({p.jobs} trabajos)</span></div></div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-purple-600">{p.price}</p>
                <button className="mt-1 flex items-center gap-1 px-3 py-1 bg-purple-600 text-white text-xs rounded-full">Pedir<ChevronRight size={12}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
