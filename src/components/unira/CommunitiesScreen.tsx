'use client';
import { useState } from 'react';
import { Heart, MessageCircle, Plus, X, Users, LogOut, Send } from 'lucide-react';
import { useAppStore, communitiesData, productsData } from '@/lib/store';
export function CommunitiesScreen() {
  const joinedCommunities = useAppStore(s=>s.joinedCommunities)||[]; const comments = useAppStore(s=>s.comments)||[]; const addComment = useAppStore(s=>s.addComment)||(()=>{}); const likeComment = useAppStore(s=>s.likeComment)||(()=>{}); const communityPosts = useAppStore(s=>s.communityPosts)||[]; const joinCommunity = useAppStore(s=>s.joinCommunity)||(()=>{}); const leaveCommunity = useAppStore(s=>s.leaveCommunity)||(()=>{}); const addPost = useAppStore(s=>s.addPost)||(()=>{}); const likePost = useAppStore(s=>s.likePost)||(()=>{});
  const [selComm, setSelComm] = useState('deportes');
  const [showExplore, setShowExplore] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [postText, setPostText] = useState(''); const [showComments, setShowComments] = useState<string|null>(null); const [commentText, setCommentText] = useState('');
  const joined = communitiesData.filter(c => joinedCommunities.includes(c.id));
  const filtered = communityPosts.filter(p => p.communityId === selComm);
  const selData = communitiesData.find(c => c.id === selComm);
  const handlePost = () => { if(!postText.trim()) return; addPost(selComm,postText.trim(),'Tu','TU'); setPostText(''); setShowNewPost(false); }; const postComments = showComments ? comments.filter(c=>c.postId===showComments) : []; const handleComment = () => { if(!commentText.trim()||!showComments) return; addComment(showComments,commentText.trim(),'Tu','TU'); setCommentText(''); };
  return (
    <div className="pb-20 bg-gray-50 min-h-screen">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 pt-6">
        <h1 className="text-xl font-bold">Comunidades</h1>
        <p className="text-purple-200 text-sm mt-1">Conecta con tu comunidad</p>
      </div>
      <div className="flex gap-2 p-3 overflow-x-auto">
        {joined.map(c => (
          <button key={c.id} onClick={() => setSelComm(c.id)}
            className={"flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all " + (selComm===c.id ? "bg-purple-600 text-white shadow-md" : "bg-white text-gray-600 border")}>
            {c.icon} {c.name}
          </button>
        ))}
        <button onClick={() => setShowExplore(true)} className="flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium bg-purple-100 text-purple-700 border border-purple-200">Explorar</button>
      </div>

      {selData && (
        <div className="mx-3 p-3 bg-white rounded-xl shadow-sm border mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selData.icon}</span>
              <div><h2 className="font-bold text-gray-800">{selData.name}</h2>
              <p className="text-xs text-gray-500">{selData.members} miembros</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNewPost(true)} className="p-2 bg-purple-600 text-white rounded-full"><Plus size={16}/></button>
              <button onClick={() => { leaveCommunity(selComm); setSelComm(joined[0]?.id||''); }} className="p-2 bg-red-50 text-red-500 rounded-full"><LogOut size={16}/></button>
            </div>
          </div>
        </div>
      )}
      
      {selComm === 'compras' && (
        <div className="px-3 pb-4">
          <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-gray-800">Ofertas del dia</h3><span className="text-xs text-purple-600 font-medium">Comision cooperativa por venta</span></div>
          <div className="grid grid-cols-2 gap-3">
            {productsData.map(p => (
              <div key={p.id} className="bg-white rounded-xl overflow-hidden shadow-sm border">
                <div className="h-28 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-4xl">{p.store === 'MercadoLibre' ? '🏪' : p.store === 'Amazon' ? '📦' : '🎁'}</div>
                <div className="p-2">
                  <p className="text-xs text-gray-500">{p.store}</p>
                  <p className="text-sm font-medium text-gray-800 line-clamp-2">{p.name}</p>
                  <p className="text-lg font-bold text-green-600">${p.price.toLocaleString()}</p>
                  <p className="text-xs text-gray-400 line-through">${p.originalPrice.toLocaleString()}</p>
                  <p className="text-xs text-purple-600 mt-1">Comision: {p.commission}%</p>
                  <button className="w-full mt-2 py-1.5 bg-purple-600 text-white text-xs rounded-full font-medium">Comprar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
<div className="space-y-3 px-3" style={{display: selComm==="compras" ? "none" : undefined}}>
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400"><Users size={40} className="mx-auto mb-2 opacity-50"/><p>Sin publicaciones todavia</p><p className="text-sm">Sé el primero en publicar!</p></div>
        ) : filtered.map(p => (
          <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">{p.authorInitial}</div>
              <span className="font-medium text-gray-800 text-sm">{p.authorName}</span>
            </div>
            <p className="text-gray-700 text-sm mb-3">{p.content}</p>

            {p.tags && p.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-3">{p.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-xs font-medium">#{tag}</span>
              ))}</div>
            )}
            <div className="flex items-center gap-4 pt-2 border-t">
              <button onClick={() => likePost(p.id)} className={"flex items-center gap-1 text-sm " + (p.isLiked ? "text-red-500" : "text-gray-400")}>
                <Heart size={16} fill={p.isLiked ? "currentColor" : "none"}/><span>{p.likes}</span>
              </button>
              <button className="flex items-center gap-1 text-sm text-gray-400" onClick={() => setShowComments(p.id)}>
                <MessageCircle size={16}/><span>{p.comments}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {showExplore && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Explorar comunidades</h2><button onClick={() => setShowExplore(false)}><X size={20}/></button></div>
            <div className="space-y-3">
              {communitiesData.filter(c => !joinedCommunities.includes(c.id)).map(c => (
                <div key={c.id} className="p-3 border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3"><span className="text-2xl">{c.icon}</span><div><p className="font-medium">{c.name}</p><p className="text-xs text-gray-500">{c.members} miembros</p></div></div>
                  <button onClick={() => { joinCommunity(c.id); setShowExplore(false); setSelComm(c.id); }} className="px-3 py-1 bg-purple-600 text-white text-sm rounded-full">Unirse</button>
                </div>
              ))}
              {communitiesData.filter(c => !joinedCommunities.includes(c.id)).length === 0 && <p className="text-center text-gray-400 py-4">Ya te uniste a todas!</p>}
            </div>
          </div>
        </div>
      )}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-5 pb-10">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Nueva publicacion</h2><button onClick={() => setShowNewPost(false)}><X size={20}/></button></div>
            <p className="text-sm text-gray-500 mb-3">En: {selData?.icon} {selData?.name}</p>
            <textarea value={postText} onChange={e => setPostText(e.target.value)} placeholder="Escribe algo..." className="w-full border rounded-xl p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-purple-400"/>
            <button onClick={handlePost} className="mt-3 w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-3 rounded-xl font-medium"><Send size={16}/> Publicar</button>
          </div>
        </div>
      )}

      {showComments && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 mx-4">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold">Comentarios</h2><button onClick={() => setShowComments(null)}><X size={20}/></button></div>
            <div className="space-y-3 max-h-60 overflow-y-auto mb-3">
              {postComments.length === 0 ? <p className="text-center text-gray-400 py-4">Sin comentarios todavia</p> : postComments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{c.authorInitial}</div>
                  <div className="flex-1"><p className="text-xs font-medium text-gray-700">{c.authorName}</p><p className="text-sm text-gray-600">{c.content}</p>
                    <button onClick={() => likeComment(c.id)} className={"text-xs mt-1 " + (c.isLiked?"text-red-500":"text-gray-400")}>{" " + (c.isLiked?"":"Me gusta") + (c.likes>0?" ("+c.likes+")":"")}</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2"><input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Escribe un comentario..." className="flex-1 border rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"/><button onClick={handleComment} className="p-2 bg-purple-600 text-white rounded-full"><Send size={16}/></button></div>
          </div>
        </div>
      )}
    </div>
  );
}
