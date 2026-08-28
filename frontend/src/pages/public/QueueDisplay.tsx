import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useQueueSocket } from '@/hooks/useQueueSocket';
import api from '@/api/client';
import { AlertTriangle, Bell, Clock, Stethoscope, User, Volume2, VolumeX, ShieldAlert, Sparkles } from 'lucide-react';

export default function QueueDisplay() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get('clinicId') || '';
  const doctorId = searchParams.get('doctorId') || '';

  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  const lastAnnouncedToken = useRef<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsLang] = useState('en-IN');
  const emergencyIntervalRef = useRef<any>(null);

  const { isConnected } = useQueueSocket({ clinicId, doctorId });

  const { data: queueData, isLoading } = useQuery({
    queryKey: ['queue', 'display', clinicId, doctorId],
    queryFn: async () => {
      const { data } = await api.get('/public/queue', {
        params: { 
          clinicId: clinicId || undefined, 
          doctorId: doctorId || undefined 
        },
      });
      return data;
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Speech Synthesis (TTS Voice Calling)
  const speak = useCallback((text: string, isPriority = false) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    
    if (isPriority) {
      window.speechSynthesis.cancel(); // Interrupt standard voice for emergency
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = ttsLang;
    utterance.rate = isPriority ? 0.95 : 0.88;
    utterance.pitch = isPriority ? 1.15 : 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === ttsLang) 
      || voices.find(v => v.lang.startsWith('en')) 
      || voices[0];
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, ttsLang]);

  // =========================================================================
  // 🚨 CONTINUOUS EMERGENCY VOICE ANNOUNCEMENT LOOP
  // Repeats every 12 seconds UNTIL patient reaches the doctor cabin!
  // =========================================================================
  const emergencyData = queueData?.emergency;
  const isEmergencyActive = !!emergencyData && emergencyData.status === 'checked_in';

  useEffect(() => {
    if (isEmergencyActive) {
      const token = emergencyData.token_number || emergencyData.tokenNumber || 'EMG';
      const patientName = emergencyData.patient_name || emergencyData.patientName || 'Emergency Patient';
      const doc = emergencyData.doctor_name || emergencyData.doctorName || 'the on-duty Doctor';
      const dept = emergencyData.department || 'Emergency Consultation Room';

      const announceEmergency = () => {
        speak(
          `Attention please. Critical Emergency call. Patient ${patientName}, Token ${token.split('').join(' ')}, please proceed immediately to ${dept} for Doctor ${doc}.`,
          true
        );
      };

      // Announce immediately once
      announceEmergency();

      // Clear existing interval if any and loop repeatedly every 12 seconds
      if (emergencyIntervalRef.current) clearInterval(emergencyIntervalRef.current);
      emergencyIntervalRef.current = setInterval(announceEmergency, 12000);
    } else {
      // Patient reached the doctor or emergency resolved: STOP AUDIO LOOP IMMEDIATELY!
      if (emergencyIntervalRef.current) {
        clearInterval(emergencyIntervalRef.current);
        emergencyIntervalRef.current = null;
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      }
    }

    return () => {
      if (emergencyIntervalRef.current) {
        clearInterval(emergencyIntervalRef.current);
        emergencyIntervalRef.current = null;
      }
    };
  }, [isEmergencyActive, emergencyData, speak]);

  // Regular Consultation Room Call Announcement
  useEffect(() => {
    if (isEmergencyActive) return; // Suppress regular call during active emergency

    const current = queueData?.current;
    const currentToken = current?.token_number || current?.tokenNumber;
    
    if (currentToken && currentToken !== lastAnnouncedToken.current) {
      lastAnnouncedToken.current = currentToken;
      const room = current?.department ? `${current.department} Consultation Room` : 'the consultation room';
      const doctorDisplay = (current?.doctor_name || current?.doctorName) ? `, Doctor ${current.doctor_name || current.doctorName}` : '';
      const patientDisplay = (current?.patient_name || current?.patientName) ? `Patient ${current.patient_name || current.patientName}, ` : '';
      
      setTimeout(() => {
        speak(`${patientDisplay}Token ${currentToken.split('').join(' ')}${doctorDisplay}, please proceed to ${room}`);
      }, 500);
    }
  }, [queueData?.current, isEmergencyActive, speak]);

  // Enable Audio toggle
  const handleEnableTTS = () => {
    setTtsEnabled(!ttsEnabled);
    if (!ttsEnabled) {
      speak('Hospital voice announcement system enabled');
    } else {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  };

  const current = queueData?.current;
  const currentToken = current?.token_number || current?.tokenNumber || (isLoading ? '...' : '--');
  const doctorName = current?.doctor_name || current?.doctorName || '';
  const clinicName = queueData?.clinic_name || queueData?.clinicName || 'Sanjeevani Multi-Specialty Hospital';
  const nextTokens: any[] = (queueData?.waiting || []).slice(0, 7);

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 p-6 md:p-10 text-white select-none relative overflow-hidden">
      {/* 🚨 TOP PROMINENT EMERGENCY ALERT BANNER (Active when Emergency Token waiting) */}
      {isEmergencyActive && (
        <div className="mb-6 p-5 rounded-3xl bg-gradient-to-r from-red-600 via-rose-700 to-red-600 text-white shadow-[0_0_50px_rgba(220,38,38,0.7)] border-2 border-red-400 animate-pulse flex flex-col md:flex-row items-center justify-between gap-4 z-50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white text-red-600 rounded-2xl animate-bounce shadow-lg">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-black/40 text-amber-300 font-mono font-black text-xs uppercase tracking-widest">
                  🚨 High Priority Emergency
                </span>
                <span className="text-xs font-bold text-red-100 uppercase tracking-wider">
                  Continuous Voice Announce Active
                </span>
              </div>
              <div className="text-2xl md:text-3xl font-black tracking-tight text-white mt-0.5">
                Patient: <span className="underline decoration-amber-300">{emergencyData.patient_name || emergencyData.patientName}</span>
              </div>
              <div className="text-xs md:text-sm font-semibold text-red-100 opacity-95">
                Proceed directly to <strong>{emergencyData.department}</strong> • Cabin 101 for <strong>Dr. {emergencyData.doctor_name || emergencyData.doctorName}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center px-6 py-2 rounded-2xl bg-black/30 border border-white/20">
              <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Emergency Token</div>
              <div className="text-4xl md:text-5xl font-black font-mono text-white tracking-wider">
                {emergencyData.token_number || emergencyData.tokenNumber}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-3.5 h-3.5 rounded-full bg-teal-500 animate-ping" />
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-stone-100">{clinicName}</h1>
          </div>
          <p className="mt-1 text-xs md:text-sm uppercase tracking-widest text-teal-400 font-bold flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            Central OPD Waiting Lounge • Live Token Board
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="font-mono text-3xl md:text-4xl font-bold text-stone-200">{time}</div>
          <button 
            onClick={handleEnableTTS}
            className={`rounded-full px-5 py-2 text-xs font-bold tracking-wide transition-all shadow-md flex items-center gap-2 ${
              ttsEnabled 
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 hover:bg-teal-500/30' 
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
            }`}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            {ttsEnabled ? 'Voice Calling: ACTIVE' : 'Audio Muted (Click to Enable)'}
          </button>
        </div>
      </div>

      {/* Main Grid: Serving & Next Up */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-stretch">
        {/* NOW SERVING HERO CARD */}
        <div className={`lg:col-span-2 flex flex-col items-center justify-center p-8 rounded-3xl border shadow-2xl relative overflow-hidden text-center transition-all ${
          current?.is_emergency
            ? 'bg-gradient-to-b from-red-950/90 via-stone-900 to-stone-900 border-red-600/80 shadow-[0_0_50px_rgba(239,68,68,0.2)]'
            : 'bg-stone-900/90 border-stone-800'
        }`}>
          <div className={`absolute top-0 inset-x-0 h-2 ${
            current?.is_emergency 
              ? 'bg-gradient-to-r from-red-500 via-amber-400 to-red-500 animate-pulse' 
              : 'bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500'
          }`} />
          
          <div className="text-xl md:text-2xl font-black uppercase tracking-widest text-stone-400 mb-2 flex items-center gap-2">
            <Bell className={`w-6 h-6 ${current?.is_emergency ? 'text-red-400 animate-bounce' : 'text-teal-400'}`} />
            {current?.is_emergency ? '🚨 EMERGENCY IN CONSULTATION' : '🔔 NOW SERVING'}
          </div>

          <div className="my-6">
            <div className={`text-8xl md:text-[11rem] font-black tracking-tighter font-mono ${
              current?.is_emergency
                ? 'text-red-400 drop-shadow-[0_0_40px_rgba(239,68,68,0.4)]'
                : 'text-teal-400 drop-shadow-[0_0_35px_rgba(20,184,166,0.3)]'
            }`}>
              {currentToken}
            </div>
          </div>

          {current ? (
            <div className="space-y-2">
              {current.patient_name && (
                <div className="text-lg font-bold text-stone-300">
                  Patient: <span className="text-white text-xl">{current.patient_name}</span>
                </div>
              )}
              <div className="text-2xl md:text-3xl font-bold text-stone-100">
                {doctorName ? `Dr. ${doctorName}` : 'Doctor OPD'}
              </div>
              <div className="inline-block px-4 py-1.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 text-xs md:text-sm font-bold uppercase tracking-wider">
                {current.department || 'OPD Consultation'} • Room 101
              </div>
            </div>
          ) : (
            <div className="text-lg text-stone-500 font-medium">
              Waiting for doctor to call next patient...
            </div>
          )}
        </div>

        {/* UPCOMING QUEUE LIST */}
        <div className="flex flex-col rounded-3xl bg-stone-900/70 border border-stone-800 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4">
            <h2 className="text-sm md:text-base font-bold uppercase tracking-wider text-stone-300 flex items-center gap-2">
              <span>📋</span> UP NEXT IN QUEUE
            </h2>
            <span className="text-xs px-3 py-1 rounded-full bg-stone-800 text-teal-400 font-mono font-bold">
              {nextTokens.length} Waiting
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1">
            {nextTokens.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500 text-xs">
                <span>No other patients waiting in queue.</span>
              </div>
            ) : (
              nextTokens.map((t: any, idx: number) => {
                const token = t.token_number || t.tokenNumber;
                const isEmergencyItem = t.is_emergency || token?.startsWith('EMG');
                const pName = t.patient_name || t.patientName;
                const doc = t.doctor_name || t.doctorName || 'OPD';

                return (
                  <div 
                    key={token || idx}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                      isEmergencyItem 
                        ? 'bg-red-950/60 border-red-600/80 shadow-md ring-1 ring-red-500/30 animate-pulse' 
                        : 'bg-stone-800/60 border-stone-700/50 hover:bg-stone-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center font-mono ${
                        isEmergencyItem ? 'bg-red-600 text-white' : 'bg-stone-700 text-stone-300'
                      }`}>
                        {isEmergencyItem ? '🚨' : idx + 1}
                      </span>
                      <div>
                        <div className={`text-2xl font-black font-mono ${isEmergencyItem ? 'text-red-400' : 'text-stone-100'}`}>
                          {token}
                        </div>
                        {pName && (
                          <div className="text-[11px] font-semibold text-stone-300 truncate max-w-[120px]">
                            {pName}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs space-y-0.5">
                      {isEmergencyItem && (
                        <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                          Emergency Priority
                        </div>
                      )}
                      <div className="font-semibold text-teal-400 text-xs">{doc}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-stone-800/80 text-center text-xs text-stone-500">
            Please be seated in the waiting lounge.
          </div>
        </div>
      </div>
    </div>
  );
}
