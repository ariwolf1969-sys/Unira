p='src/lib/store.ts'
f=open(p,'r',encoding='utf-8').read()
f=f.replace('  addToHistory: (t: Trip) => void;','  addToHistory: (t: Trip) => void;\n  tripVerificationCode: string | null;\n  setTripVerificationCode: (code: string | null) => void;',1)
old2='  addToHistory: (t) =>\n    set((s) => ({ tripHistory: [t, ...s.tripHistory] })),'
new2='  addToHistory: (t) =>\n    set((s) => ({ tripHistory: [t, ...s.tripHistory] })),\n  tripVerificationCode: null,\n  setTripVerificationCode: (code) => set({ tripVerificationCode: code }),'
idx=f.find(old2)
f=f[:idx]+new2+f[idx+len(old2):]
open(p,'w',encoding='utf-8').write(f)
print('store OK')
p2='src/components/unira/RideScreen.tsx'
f2=open(p2,'r',encoding='utf-8').read()
f2=f2.replace("  const [driver, setDriver] = useState<DriverData | null>(null);","  const [driver, setDriver] = useState<DriverData | null>(null);\n  const [verificationCode, setVerificationCode] = useState('');",1)
f2=f2.replace("    setDriver(getRandomDriver());\n    transitionTo('searching');","    setDriver(getRandomDriver());\n    const code = String(Math.floor(1000 + Math.random() * 9000));\n    setVerificationCode(code);\n    store.setTripVerificationCode(code);\n    transitionTo('searching');",1)
f2=f2.replace("    setDriver(null);","    setDriver(null);\n    setVerificationCode('');\n    store.setTripVerificationCode(null);",1)
nl=chr(10)
m='            </div>'+nl+nl+'            <p className="text-center text-xs text-gray-400 mt-4">El conductor llega a tu punto de partida...</p>'
v='            </div>'+nl+nl+'            {/* Verification code */}'+nl+'            {verificationCode && ('+nl+'              <div className="mt-4 pt-4 border-t border-gray-100 text-center">'+nl+'                <p className="text-xs text-gray-500 mb-2">Codigo de verificacion</p>'+nl+'                <div className="flex justify-center gap-2">'+nl+'                  {verificationCode.split(String()).map((d, i) => ('+nl+'                    <div key={i} className="w-10 h-12 rounded-xl bg-[#0EA5A0]/10 border-2 border-[#0EA5A0]/30 flex items-center justify-center">'+nl+'                      <span className="text-xl font-bold text-[#0EA5A0]">{d}</span>'+nl+'                    </div>'+nl+'                  ))}'+nl+'                </div>'+nl+'                <p className="text-[10px] text-gray-400 mt-2">Mostra este codigo al conductor</p>'+nl+'              </div>'+nl+'            )}'+nl+'            </div>'+nl+nl+'            <p className="text-center text-xs text-gray-400 mt-4">El conductor llega a tu punto de partida...</p>'
if m in f2:
    f2=f2.replace(m,v,1)
    print('RideScreen OK')
else:
    print('MARKER NOT FOUND')
open(p2,'w',encoding='utf-8').write(f2)
print('Done')
