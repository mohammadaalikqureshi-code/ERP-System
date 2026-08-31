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

  // Hospital Melodic Attention Chime (Ding-Dong) to grab hall attention & wake audio context
  const playChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.18); // A5
      gain2.gain.setValueAtTime(0.3, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.log("Audio chime error:", e);
    }
  }, []);

  // Web Speech Synthesis (Sequential Chained Bilingual Engine: English FIRST, Hindi SECOND)
  // Protected against Chrome V8 Garbage Collection Bug
  const speakBilingual = useCallback((enText: string, hiText: string, isPriority = false, onComplete?: () => void) => {
    if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    
    playChime();

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {}

    const voices = window.speechSynthesis.getVoices() || [];
    const enVoice = voices.find(v => v.lang === 'en-IN') 
      || voices.find(v => v.lang.startsWith('en')) 
      || voices[0];
    const hiVoice = voices.find(v => v.lang === 'hi-IN') 
      || voices.find(v => v.lang.startsWith('hi')) 
      || enVoice;

    // 1. English Announcement
    const utteranceEn = new SpeechSynthesisUtterance(enText);
    utteranceEn.lang = 'en-IN';
    utteranceEn.rate = isPriority ? 0.95 : 0.88;
    utteranceEn.pitch = isPriority ? 1.15 : 1.0;
    utteranceEn.volume = 1.0;
    if (enVoice) utteranceEn.voice = enVoice;

    // 2. Hindi Announcement
    const utteranceHi = new SpeechSynthesisUtterance(hiText);
    utteranceHi.lang = 'hi-IN';
    utteranceHi.rate = isPriority ? 0.92 : 0.85;
    utteranceHi.pitch = isPriority ? 1.1 : 1.0;
    utteranceHi.volume = 1.0;
    if (hiVoice) utteranceHi.voice = hiVoice;

    // Keep references in global window scope so Chrome Garbage Collector cannot kill speech
    (window as any)._activeUtterances = [utteranceEn, utteranceHi];

    // English finishes -> Start Hindi
    utteranceEn.onend = () => {
      setTimeout(() => {
        try {
          if (window.speechSynthesis) {
            window.speechSynthesis.speak(utteranceHi);
          }
        } catch (e) {
          onComplete?.();
        }
      }, 150);
    };

    utteranceEn.onerror = () => {
      try {
        if (window.speechSynthesis) {
          window.speechSynthesis.speak(utteranceHi);
        }
      } catch (e) {
        onComplete?.();
      }
    };

    // Hindi finishes -> Call onComplete
    utteranceHi.onend = () => {
      (window as any)._activeUtterances = [];
      onComplete?.();
    };

    utteranceHi.onerror = () => {
      (window as any)._activeUtterances = [];
      onComplete?.();
    };

    // Start English after short 250ms delay for chime to ring
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        window.speechSynthesis.speak(utteranceEn);
      } catch (e) {
        console.error("Speech speak failed", e);
      }
    }, 280);
  }, [ttsEnabled, playChime]);

  // Track user gesture interaction for browser audio unlock
  const [hasInteracted, setHasInteracted] = useState(false);
  const pendingAnnouncement = useRef<{ en: string; hi: string } | null>(null);

  // Unlock browser audio context on any user touch/click/interaction
  useEffect(() => {
    const unlockAudio = () => {
      setHasInteracted(true);
      if (window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      if (pendingAnnouncement.current) {
        const { en, hi } = pendingAnnouncement.current;
        pendingAnnouncement.current = null;
        setTimeout(() => {
          speakBilingual(en, hi, false);
        }, 300);
      }
    };
    ['click', 'dblclick', 'touchstart', 'keydown', 'mousedown'].forEach(evt => {
      window.addEventListener(evt, unlockAudio);
    });
    return () => {
      ['click', 'dblclick', 'touchstart', 'keydown', 'mousedown'].forEach(evt => {
        window.removeEventListener(evt, unlockAudio);
      });
    };
  }, [speakBilingual]);

  // Force-load voices on mount
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Chrome periodic resume watchdog
  useEffect(() => {
    const watchdog = setInterval(() => {
      if (window.speechSynthesis && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 5000);
    return () => clearInterval(watchdog);
  }, []);

  // =========================================================================
  // 🚨 CONTINUOUS EMERGENCY VOICE ANNOUNCEMENT LOOP (Bilingual)
  // =========================================================================
  const emergencyData = queueData?.emergency;
  const isEmergencyActive = !!emergencyData && (emergencyData.status === 'checked_in' || emergencyData.status === 'CHECKED_IN');

  const [silencedEmergencyToken, setSilencedEmergencyToken] = useState<string | null>(null);
  const emergencyActiveRef = useRef(false);

  useEffect(() => {
    const currentEmergencyToken = emergencyData?.token_number || emergencyData?.tokenNumber;
    const isSilenced = silencedEmergencyToken === currentEmergencyToken;

    if (isEmergencyActive && !isSilenced) {
      emergencyActiveRef.current = true;
      const token = currentEmergencyToken || 'EMG-01';
      const patientName = emergencyData.patient_name || emergencyData.patientName || 'Emergency Patient';
      const doc = emergencyData.doctor_name || emergencyData.doctorName || 'Doctor';
      const dept = emergencyData.department || 'Emergency OPD Consultation Room';

      const enEmergency = `Attention please. Critical Emergency Call. Patient ${patientName}, Token ${token.split('').join(' ')}, please proceed immediately to ${dept} for Doctor ${doc}.`;
      const hiEmergency = `कृपया ध्यान दें। आपातकालीन बुलावा। मरीज ${patientName}, टोकन नंबर ${token.split('').join(' ')}, कृपया तुरंत ${dept}, डॉक्टर ${doc} के पास पहुंचें।`;

      const announceLoop = () => {
        if (!emergencyActiveRef.current) return;
        speakBilingual(enEmergency, hiEmergency, true, () => {
          if (emergencyActiveRef.current) {
            emergencyIntervalRef.current = setTimeout(announceLoop, 2000);
          }
        });
      };

      if (emergencyIntervalRef.current) clearTimeout(emergencyIntervalRef.current);
      announceLoop();
    } else {
      emergencyActiveRef.current = false;
      if (emergencyIntervalRef.current) {
        clearTimeout(emergencyIntervalRef.current);
        emergencyIntervalRef.current = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    return () => {
      emergencyActiveRef.current = false;
      if (emergencyIntervalRef.current) {
        clearTimeout(emergencyIntervalRef.current);
        emergencyIntervalRef.current = null;
      }
    };
  }, [isEmergencyActive, emergencyData, silencedEmergencyToken, speakBilingual]);

  // Handle manual silencing of the emergency voice alarm
  const handleSilenceEmergencyAlarm = () => {
    const currentToken = emergencyData?.token_number || emergencyData?.tokenNumber;
    if (silencedEmergencyToken === currentToken) {
      setSilencedEmergencyToken(null);
      speakBilingual('Emergency voice alert resumed', 'आपातकालीन आवाज चेतावनी फिर से शुरू की गई', true);
    } else {
      setSilencedEmergencyToken(currentToken);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (emergencyIntervalRef.current) {
        clearTimeout(emergencyIntervalRef.current);
        emergencyIntervalRef.current = null;
      }
    }
  };

  // Regular Consultation Room Call Announcement (Bilingual: English + Hindi)
  useEffect(() => {
    if (isEmergencyActive) return;

    const current = queueData?.current;
    const currentToken = current?.token_number || current?.tokenNumber;
    
    if (currentToken && currentToken !== lastAnnouncedToken.current) {
      lastAnnouncedToken.current = currentToken;
      const dept = current?.department || 'OPD';
      const room = current?.department ? `${current.department} Consultation Room` : 'the consultation room';
      const docName = current?.doctor_name || current?.doctorName || '';
      const patName = current?.patient_name || current?.patientName || '';

      const spelledToken = currentToken.split('').join(' ');
      const doctorDisplayEn = docName ? `for Doctor ${docName}` : '';
      const doctorDisplayHi = docName ? `डॉक्टर ${docName}` : 'डॉक्टर';
      const patientDisplayEn = patName ? `Patient ${patName}, ` : '';
      const patientDisplayHi = patName ? `मरीज ${patName}, ` : '';

      const enText = `${patientDisplayEn}Token ${spelledToken}, please proceed to ${room} ${doctorDisplayEn}.`;
      const hiText = `${patientDisplayHi}टोकन नंबर ${spelledToken}, कृपया ${dept} परामर्श कक्ष, ${doctorDisplayHi} के पास जाएं।`;

      pendingAnnouncement.current = { en: enText, hi: hiText };
      
      setTimeout(() => {
        speakBilingual(enText, hiText, false);
      }, 400);
    }
  }, [queueData?.current, isEmergencyActive, speakBilingual]);

  // =========================================================================
  // 🔊 VOICE SYSTEM TOGGLE (Auto Starts on Open, Double-Click Anywhere to Turn OFF/ON)
  // =========================================================================
  const handleToggleVoice = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setTtsEnabled((prev) => {
      const nextState = !prev;
      localStorage.setItem('tv_voice_calling_active', String(nextState));
      if (nextState) {
        if (window.speechSynthesis && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        speakBilingual(
          'Bilingual voice system is active.',
          'द्विभाषी आवाज प्रणाली सक्रिय है।'
        );
      } else {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      }
      return nextState;
    });
  }, [speakBilingual]);

  const current = queueData?.current;
  const currentToken = current?.token_number || current?.tokenNumber || (isLoading ? '...' : '--');
  const doctorName = current?.doctor_name || current?.doctorName || '';
  const clinicName = queueData?.clinic_name || queueData?.clinicName || 'Sanjeevani Multi-Specialty Hospital';
  const isCurrentEmergency = !!(current?.is_emergency || current?.isEmergency || currentToken?.startsWith('EMG'));

  // Get waiting tokens
  const nextTokens: any[] = (queueData?.waiting || []).slice(0, 8);

  return (
    <div 
      onDoubleClick={() => handleToggleVoice()}
      title="Double-click anywhere on the screen to Turn ON / OFF Voice Announcements"
      className="flex min-h-screen flex-col bg-stone-950 p-6 md:p-10 text-white select-none relative overflow-hidden cursor-default"
    >
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="font-mono text-2xl md:text-3xl font-bold text-stone-200">{time}</div>
          
          <button
            type="button"
            onClick={() => {
              setHasInteracted(true);
              const token = currentToken !== '--' && currentToken !== '...' ? currentToken : 'A-001';
              const doc = doctorName || 'Vikram Nair';
              const en = `Attention please. Token ${token.split('').join(' ')}, please proceed to Orthopaedics Consultation Room for Doctor ${doc}.`;
              const hi = `कृपया ध्यान दें। टोकन नंबर ${token.split('').join(' ')}, कृपया Orthopaedics परामर्श कक्ष, डॉक्टर ${doc} के पास जाएं।`;
              speakBilingual(en, hi, false);
            }}
            className="rounded-full px-4 py-2 text-xs font-bold bg-teal-600/30 text-teal-300 border border-teal-400 hover:bg-teal-600/50 flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
            title="Click to hear a test announcement immediately in English + Hindi"
          >
            <Volume2 className="w-4 h-4 text-teal-300" />
            <span>🔊 Test Voice</span>
          </button>

          <button 
            onClick={handleToggleVoice}
            title={ttsEnabled ? "Bilingual Voice (English + Hindi) is Active. Click or Double-click anywhere on screen to Turn OFF." : "Click to activate Bilingual Voice Calling."}
            className={`rounded-full px-5 py-2.5 text-xs font-black tracking-wide transition-all shadow-xl flex items-center gap-2 cursor-pointer ${
              ttsEnabled 
                ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500/30' 
                : 'bg-rose-600/30 text-rose-300 border-2 border-rose-500 animate-pulse hover:bg-rose-600/40'
            }`}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
            {ttsEnabled ? '🔊 Voice: English + हिन्दी (Auto Active)' : '🔇 Audio Muted (Click to Enable)'}
          </button>
        </div>
      </div>

      {/* 🔔 Interactive Browser Audio Unlock Notification (Disappears after first click) */}
      {!hasInteracted && (
        <div 
          onClick={() => {
            setHasInteracted(true);
            playChime();
            const token = currentToken !== '--' && currentToken !== '...' ? currentToken : 'A-001';
            const doc = doctorName || 'Vikram Nair';
            const en = `Attention please. Token ${token.split('').join(' ')}, please proceed to Orthopaedics Consultation Room for Doctor ${doc}.`;
            const hi = `कृपया ध्यान दें। टोकन नंबर ${token.split('').join(' ')}, कृपया Orthopaedics परामर्श कक्ष, डॉक्टर ${doc} के पास जाएं।`;
            speakBilingual(en, hi, false);
          }}
          className="mb-6 p-4 rounded-2xl bg-teal-500/20 border-2 border-teal-400 text-teal-200 text-center font-bold text-sm shadow-xl animate-pulse cursor-pointer flex items-center justify-center gap-2 hover:bg-teal-500/30 transition-all"
        >
          <Volume2 className="w-5 h-5 text-teal-300 animate-bounce" />
          <span>🔔 TV Audio Muted by Browser — Click Anywhere Here to Enable Live Voice Announcements</span>
        </div>
      )}

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

          <div className="mt-4 pt-4 border-t border-stone-800/80 text-center text-xs text-stone-400 flex flex-col items-center gap-1">
            <span className="text-stone-300 font-semibold">Please be seated in the waiting lounge.</span>
            <span className="text-[11px] text-stone-500 flex items-center gap-1.5">
              <span>🔊</span>
              <span>Bilingual Voice Calling: English + हिन्दी • Double-click anywhere to Mute/Unmute</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
