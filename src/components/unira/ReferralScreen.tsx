'use client';
import { useAppStore } from '@/lib/store';
import { Copy, Share2, Gift, Users, Check } from 'lucide-react';
import { useState } from 'react';
export function ReferralScreen() {
  const { goBack } = useAppStore();
  const code = 'UNIRA-' + 'ARI1969';
  const invited = 7;
  const goal = 10;
  const progress = Math.min((invited/goal)*100, 100);
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const handleShare = () => { if(navigator.share) { navigator.share({title:'Unite a Unira!',text:'Descarga Unira y usa mi codigo '+code+' para obtener beneficios!',url:'https://unira.vercel.app'}); } };
  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 text-white p-4 pt-6">
        <div className="flex items-center gap-3"><button onClick={goBack}><span className="text-xl">{'<'}</span></button><h1 className="text-xl font-bold">Invitar amigos</h1></div>
      </div>
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-5 text-white text-center">
          <Gift size={40} className="mx-auto mb-2"/><h2 className="text-2xl font-bold">Gana premios invitando amigos</h2><p className="text-purple-200 mt-1 text-sm">Comparti tu codigo y ambos ganan</p>
        </div>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm border">
          <p className="text-xs text-gray-500 mb-2">Tu codigo de referido</p>
          <p className="text-2xl font-bold tracking-widest text-purple-700">{code}</p>
          <div className="flex gap-2 mt-3 justify-center">
            <button onClick={handleCopy} className="flex items-center gap-1 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">{copied ? <Check size={16}/> : <Copy size={16}/>}{copied ? 'Copiado!' : 'Copiar'}</button>
            <button onClick={handleShare} className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium"><Share2 size={16}/>Compartir</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-gray-700">Progreso</span><span className="text-sm text-purple-600 font-bold">{invited}/{goal} invitados</span></div>
          <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all" style={{width: progress+'%'}}></div></div>
          <p className="text-xs text-gray-500 mt-2">Invita {goal-invited} personas mas y ganas un viaje gratis</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border"><Users size={20} className="mx-auto text-purple-500 mb-1"/><p className="text-lg font-bold text-gray-800">{invited}</p><p className="text-xs text-gray-500">Invitados</p></div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border"><Gift size={20} className="mx-auto text-green-500 mb-1"/><p className="text-lg font-bold text-gray-800">$3500</p><p className="text-xs text-gray-500">Ganado</p></div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm border"><span className="text-xl block mb-1">{'⭐'}</span><p className="text-lg font-bold text-gray-800">1</p><p className="text-xs text-gray-500">Viaje gratis</p></div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <h3 className="font-bold text-gray-800 mb-3">Como funciona</h3>
          <div className="space-y-3">
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span><div><p className="text-sm font-medium text-gray-700">Comparti tu codigo</p><p className="text-xs text-gray-500">Envialo por WhatsApp, redes o donde quieras</p></div></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span><div><p className="text-sm font-medium text-gray-700">Tu amigo se registra</p><p className="text-xs text-gray-500">Usa tu codigo al crear su cuenta</p></div></div>
            <div className="flex gap-3"><span className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0">3</span><div><p className="text-sm font-medium text-gray-700">Ambos ganan</p><p className="text-xs text-gray-500">$500 en billetera para cada uno</p></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
