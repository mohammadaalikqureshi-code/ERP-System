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
  
  // Permanent Voicer (Default: Always ON, persisted in localStorage)
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const saved = localStorage.getItem('tv_voice_calling_active');
    return saved !== 'false'; // Default TRUE permanently
  });
  
  const [ttsLang] = useState('en-IN');
  const emergencyIntervalRef = useRef<any>(null);
  const clickTimerRef = useRef<any>(null);

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
    refetchInterval: 2500,
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

  // Unlock browser audio context on any user touch/click/interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // =========================================================================
  // 🚨 CONTINUOUS EMERGENCY VOICE ANNOUNCEMENT LOOP
  // Repeats every 10 seconds UNTIL patient reaches the doctor cabin!
  // =========================================================================
  const emergencyData = queueData?.emergency;
  const isEmergencyActive = !!emergencyData && (emergencyData.status === 'checked_in' || emergencyData.status === 'CHECKED_IN');

  const [silencedEmergencyToken, setSilencedEmergencyToken] = useState<string | null>(null);

  useEffect(() => {
    const currentEmergencyToken = emergencyData?.token_number || emergencyData?.tokenNumber;
    const isSilenced = silencedEmergencyToken === currentEmergencyToken;

    if (isEmergencyActive && !isSilenced) {
      const token = currentEmergencyToken || 'EMG-01';
      const patientName = emergencyData.patient_name || emergencyData.patientName || 'Emergency Patient';
      const doc = emergencyData.doctor_name || emergencyData.doctorName || 'Doctor';
      const dept = emergencyData.department || 'Emergency OPD Consultation Room';

      const announceEmergency = () => {
        speak(
          `Attention please. Critical Emergency call. Patient ${patientName}, Token ${token.split('').join(' ')}, please proceed immediately to ${dept} for Doctor ${doc}.`,
          true
        );
      };

      // Announce immediately once
      announceEmergency();

      // Clear existing interval if any and loop repeatedly every 10 seconds
      if (emergencyIntervalRef.current) clearInterval(emergencyIntervalRef.current);
      emergencyIntervalRef.current = setInterval(announceEmergency, 10000);
    } else {
      // Patient reached doctor OR silenced: STOP AUDIO LOOP IMMEDIATELY!
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
  }, [isEmergencyActive, emergencyData, silencedEmergencyToken, speak]);

  // Handle manual silencing of the emergency voice alarm
  const handleSilenceEmergencyAlarm = () => {
    const currentToken = emergencyData?.token_number || emergencyData?.tokenNumber;
    if (silencedEmergencyToken === currentToken) {
      setSilencedEmergencyToken(null);
      speak('Emergency voice alert resumed', true);
    } else {
      setSilencedEmergencyToken(currentToken);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (emergencyIntervalRef.current) {
        clearInterval(emergencyIntervalRef.current);
        emergencyIntervalRef.current = null;
      }
    }
  };

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

  // =========================================================================
  // 🔊 PERMANENT VOICER TOGGLE LOGIC:
  // 1 Click = Turn ON / Keep Permanently ON
  // 2 Clicks (Double Click) = Turn OFF / Mute
  // =========================================================================
  const handleSingleClick = () => {
    if (!ttsEnabled) {
      setTtsEnabled(true);
      localStorage.setItem('tv_voice_calling_active', 'true');
      speak('Hospital voice announcement system is now active');
    } else {
      speak('Voice caller is active. Double-click to mute audio.');
    }
  };

  const handleDoubleClick = () => {
    if (ttsEnabled) {
      setTtsEnabled(false);
      localStorage.setItem('tv_voice_calling_active', 'false');
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  };

  const current = queueData?.current;
  const currentToken = current?.token_number || current?.tokenNumber || (isLoading ? '...' : '--');
  const doctorName = current?.doctor_name || current?.doctorName || '';
  const clinicName = queueData?.clinic_name || queueData?.clinicName || 'Sanjeevani Multi-Specialty Hospital';
  const isCurrentEmergency = !!(current?.is_emergency || current?.isEmergency || currentToken?.startsWith('EMG'));

  // Get waiting tokens
  const nextTokens: any[] = (queueData?.waiting || []).slice(0, 8);

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 p-6 md:p-10 text-white select-none relative overflow-hidden">
      {/* 🚨 TOP PROMINENT EMERGENCY ALERT BANNER (Active when Emergency Token waiting) */}
      {isEmergencyActive && (
        <div className="mb-6 p-5 rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white shadow-[0_0_60px_rgba(239,68,68,0.9)] border-4 border-white animate-pulse flex flex-col md:flex-row items-center justify-between gap-4 z-50">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-white text-red-600 rounded-2xl animate-bounce shadow-2xl">
              <ShieldAlert className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-black/60 text-amber-300 font-mono font-black text-xs uppercase tracking-widest border border-amber-400">
                  🚨 CRITICAL EMERGENCY CALL
                </span>
                <span className="text-xs font-black text-white uppercase tracking-wider bg-red-800/80 px-2.5 py-0.5 rounded-full animate-ping">
                  VOICE CALLING LIVE
                </span>
              </div>
              <div className="text-3xl md:text-4xl font-black tracking-tight text-white mt-1 drop-shadow-md">
                Patient: <span className="text-amber-200 underline decoration-amber-300">{emergencyData.patient_name || emergencyData.patientName}</span>
              </div>
              <div className="text-sm md:text-base font-bold text-white mt-0.5 opacity-95">
                Proceed directly to <strong>{emergencyData.department}</strong> • Cabin 101 for <strong>Dr. {emergencyData.doctor_name || emergencyData.doctorName}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSilenceEmergencyAlarm}
              className="px-4 py-2.5 rounded-xl bg-black/60 hover:bg-black/80 text-white font-bold text-xs border border-white/30 flex items-center gap-1.5 transition-all shadow-lg cursor-pointer shrink-0"
              title="Click to silence/resume continuous emergency voice alarm"
            >
              {silencedEmergencyToken === (emergencyData.token_number || emergencyData.tokenNumber) ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>Resume Voice Alarm</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-amber-300" />
                  <span>🔕 Silence Alarm</span>
                </>
              )}
            </button>

            <div className="text-center px-6 py-2.5 rounded-2xl bg-black/50 border-2 border-amber-300 shadow-xl">
              <div className="text-[10px] uppercase tracking-widest text-amber-300 font-black">Emergency Token</div>
              <div className="text-4xl md:text-5xl font-black font-mono text-white tracking-wider drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
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
            onClick={handleSingleClick}
            onDoubleClick={handleDoubleClick}
            title={ttsEnabled ? "Voice Calling is PERMANENTLY ON. Double-click to mute." : "Click once to activate voice calling."}
            className={`rounded-full px-5 py-2.5 text-xs font-black tracking-wide transition-all shadow-xl flex items-center gap-2 cursor-pointer ${
              ttsEnabled 
                ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500/30' 
                : 'bg-rose-600/30 text-rose-300 border-2 border-rose-500 animate-pulse hover:bg-rose-600/40'
            }`}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            {ttsEnabled ? '🔊 Voice Calling: PERMANENTLY ACTIVE' : '🔇 Audio Muted (Click to Enable)'}
          </button>
        </div>
      </div>

      {/* Main Grid: Serving & Next Up */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-stretch">
        {/* NOW SERVING HERO CARD */}
        <div className={`lg:col-span-2 flex flex-col items-center justify-center p-8 rounded-3xl border shadow-2xl relative overflow-hidden text-center transition-all ${
          isCurrentEmergency
            ? 'bg-gradient-to-b from-red-950 via-stone-900 to-stone-900 border-4 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.5)] animate-pulse'
            : 'bg-stone-900/90 border-stone-800'
        }`}>
          <div className={`absolute top-0 inset-x-0 h-2.5 ${
            isCurrentEmergency 
              ? 'bg-gradient-to-r from-red-500 via-amber-400 to-red-500 animate-pulse' 
              : 'bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500'
          }`} />
          
          <div className="text-xl md:text-2xl font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            <Bell className={`w-7 h-7 ${isCurrentEmergency ? 'text-red-400 animate-bounce' : 'text-teal-400'}`} />
            <span className={isCurrentEmergency ? 'text-red-400 font-black' : 'text-stone-400 font-bold'}>
              {isCurrentEmergency ? '🚨 EMERGENCY IN CONSULTATION' : '🔔 NOW SERVING'}
            </span>
          </div>

          <div className="my-6">
            <div className={`text-8xl md:text-[11rem] font-black tracking-tighter font-mono ${
              isCurrentEmergency
                ? 'text-red-500 drop-shadow-[0_0_50px_rgba(239,68,68,0.9)]'
                : 'text-teal-400 drop-shadow-[0_0_35px_rgba(20,184,166,0.3)]'
            }`}>
              {currentToken}
            </div>
          </div>

          {current ? (
            <div className="space-y-2">
              {current.patient_name && (
                <div className="text-lg font-bold text-stone-300">
                  Patient: <span className="text-white text-xl font-bold">{current.patient_name}</span>
                </div>
              )}
              <div className="text-2xl md:text-3xl font-black text-stone-100">
                {doctorName ? `Dr. ${doctorName}` : 'Doctor OPD'}
              </div>
              <div className={`inline-block px-4 py-1.5 rounded-full text-xs md:text-sm font-black uppercase tracking-wider border ${
                isCurrentEmergency
                  ? 'bg-red-950 text-red-300 border-red-700'
                  : 'bg-teal-950 text-teal-300 border-teal-800'
              }`}>
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
                const token = t.token_number || t.tokenNumber || '';
                const isEmergencyItem = !!(
                  t.is_emergency || 
                  t.isEmergency || 
                  t.visit_type === 'emergency' || 
                  t.visitType === 'emergency' || 
                  token.startsWith('EMG')
                );
                const pName = t.patient_name || t.patientName;
                const doc = t.doctor_name || t.doctorName || 'OPD';

                return (
                  <div 
                    key={token || idx}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      isEmergencyItem 
                        ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-600 border-white text-white shadow-[0_0_25px_rgba(239,68,68,0.85)] animate-pulse' 
                        : 'bg-stone-800/60 border-stone-700/50 hover:bg-stone-800 text-stone-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full text-xs font-black flex items-center justify-center font-mono ${
                        isEmergencyItem ? 'bg-black text-amber-300 shadow-md' : 'bg-stone-700 text-stone-300'
                      }`}>
                        {isEmergencyItem ? '🚨' : idx + 1}
                      </span>
                      <div>
                        <div className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${
                          isEmergencyItem ? 'text-white drop-shadow-md' : 'text-stone-100'
                        }`}>
                          {token}
                        </div>
                        {pName && (
                          <div className={`text-xs font-bold truncate max-w-[130px] ${
                            isEmergencyItem ? 'text-amber-200' : 'text-stone-300'
                          }`}>
                            {pName}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xs space-y-0.5">
                      {isEmergencyItem ? (
                        <div className="px-2 py-0.5 rounded-full bg-black/50 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-300">
                          🚨 Emergency Priority
                        </div>
                      ) : null}
                      <div className={`font-bold text-xs ${
                        isEmergencyItem ? 'text-white font-black' : 'text-teal-400 font-semibold'
                      }`}>
                        {doc ? `Dr. ${doc}` : 'OPD'}
                      </div>
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
