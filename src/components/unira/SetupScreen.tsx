'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, Zap, ArrowRight, SkipForward, Info } from 'lucide-react';

export function SetupScreen() {
  const [config, setConfig] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { navigateTo, setIsFirebaseReady, showToast } = useAppStore();

  const handleSave = async () => {
    setError('');

    // Validate JSON
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(config.trim());
    } catch {
      setError('JSON inválido. Verificá el formato y probá de nuevo.');
      return;
    }

    // Check required Firebase fields
    const required = ['apiKey', 'authDomain', 'projectId'];
    const missing = required.filter((k) => !parsed[k]);
    if (missing.length > 0) {
      setError(`Faltan campos requeridos: ${missing.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      // Store config in localStorage
      localStorage.setItem('unira_firebase_config', config.trim());
      setIsFirebaseReady(true);
      showToast('Firebase configurado correctamente', 'success');
      navigateTo('auth');
    } catch {
      setError('Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    setIsFirebaseReady(false);
    showToast('Modo demo activado', 'info');
    navigateTo('role');
  };

  const handlePasteSample = () => {
    const sample = JSON.stringify({
      apiKey: "TU_API_KEY",
      authDomain: "tu-proyecto.firebaseapp.com",
      projectId: "tu-proyecto-id",
      storageBucket: "tu-proyecto.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000"
    }, null, 2);
    setConfig(sample);
    setError('');
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#0A0F14] px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}>
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Configurar Firebase</h1>
        <p className="text-[#8B9DAF] text-sm leading-relaxed">
          Conectá tu proyecto de Firebase para autenticación real y datos en la nube.
        </p>
      </div>

      {/* Info card */}
      <Card className="bg-[#141B24] border-[#1E2A38] mb-5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0EA5A0]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="w-4 h-4 text-[#0EA5A0]" />
          </div>
          <div>
            <p className="text-[#C8D6E5] text-sm font-medium mb-1">
              Firebase es opcional
            </p>
            <p className="text-[#6B7F95] text-xs leading-relaxed">
              Podés usar Unira en modo demo sin Firebase. Las funciones de autenticación y datos simulados funcionarán con datos de ejemplo.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Config textarea */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[#8B9DAF] text-xs font-medium uppercase tracking-wider">
            Configuración JSON
          </label>
          <button
            onClick={handlePasteSample}
            className="text-[#0EA5A0] text-xs font-medium hover:text-[#12BEB8] transition-colors"
          >
            Ver ejemplo
          </button>
        </div>
        <Textarea
          value={config}
          onChange={(e) => { setConfig(e.target.value); setError(''); }}
          placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
          className="bg-[#141B24] border-[#1E2A38] text-[#C8D6E5] placeholder:text-[#3D5068] min-h-[180px] resize-none font-mono text-xs leading-relaxed rounded-xl"
        />
        {error && (
          <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
            {error}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-6 space-y-3">
        <Button
          onClick={handleSave}
          disabled={saving || !config.trim()}
          className="w-full h-12 rounded-xl text-white font-semibold text-sm transition-all"
          style={{ background: saving ? undefined : 'linear-gradient(135deg, #0EA5A0, #0C8CE9)' }}
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Guardar y continuar
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        <button
          onClick={handleSkip}
          className="w-full h-12 rounded-xl border border-[#1E2A38] text-[#8B9DAF] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#141B24] hover:text-white transition-all"
        >
          <SkipForward className="w-4 h-4" />
          Saltar (modo demo)
        </button>
      </div>
    </div>
  );
}
