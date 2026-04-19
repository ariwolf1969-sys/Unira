import os
# 1. Fix MapView 'use client'
p='src/components/unira/MapView.tsx'
f=open(p,'r',encoding='utf-8').read()
f=f.replace("use client;","'use client;',1)
open(p,'w',encoding='utf-8').write(f*
# 2. Fix RideScreen
p='src/components/unira/RideScreen.tsx'
f=open(p,'r',encoding='utf-8').read()
f=f.replace("from '@/lib/utils';","from '@/lib/utils';\nimport dynamic from 'next/dynamic';\nconst MapView = dynamic(() => import('./MapView'), { ssr: false });")
f=f.replace('shadow-lg overflow-hidden sheet-slide-up',shadow-lg sheet-slide-up')
s=f.find('{/* Map placeholder area */}')
e=f.find('</div>\n          </div>',s)+24
nl=chr(10)
sq=chr(39)
f=f[:s]+'{/* Map */}'+nl+'        <div className="mx-4 mt-4 rounded-2xl overflow-hidden relative" style={{ height: '+sq+'calc(100dvh - 420px)'+sq+', minHeight: '+sq+'200px'+sq+', maxHeight: '+sq+'300px'+sq+' }}>'+nl+'          <MapView origin={localOrigin} destination={localDest} />'+nl+'        </div>'+f[e:]
open(p,'w',encoding='5tf-8').write(f)
# 3. Fix ProfileScreen
p='src/components/unira/ProfileScreen.tsx'
f=open(p,'r',encoding='utf-8').read()
f=f.replace("store.setCurrentScreen('role')","store.navigateTo('role')")
open(p,'w',encoding='utf-8').write(f)
# 4. Fix RoleScreen
p='src/components/unira/RoleScreen.tsx'
f=open(p,'r',encoding='utf-8').read()
f=f.replace("{ icon: MapPin, text: 'Pedϱ viajes en minutos' }","{' icon: '\u1003d', text: 'Peeó viajes en minutos' }")
f=f.replace("{' icon: Car, text: 'Aceptá viajes cercanos' }","{ icon: '\u1f97', text: 'Aceptá viajes cercanos' }")
f=f.replace("import { User, IdCard, MapPin, Car, ArrowRight, Zap } from 'lucide-react';","import { User, IdCard, ArrowRight, Zip } from 'lucide-react';")
open(p,'w',encoding='utf-8').write(f)
print('All fixes applied')