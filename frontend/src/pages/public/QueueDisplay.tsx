import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { useQueueSocket } from '@/hooks/useQueueSocket';
import api from '@/api/client';

/**
 * Waiting-room screen with TTS voice calling.
 * Open full-screen on a TV:
 *   /queue/display (auto-connects to primary clinic)
 *   /queue/display?clinicId=<uuid>&doctorId=<uuid>
 *
 * TTS announces: "Token A-003, please proceed to consultation room"
 */
export default function QueueDisplay() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get('clinicId') || '';
  const doctorId = searchParams.get('doctorId') || '';

  const [time, setTime] = useState(() => new Date().toLocaleTimeString());
  const lastAnnouncedToken = useRef<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsLang] = useState('en-IN');

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
    refetchInterval: 5000,
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // TTS Voice Calling
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = ttsLang;
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === ttsLang) 
      || voices.find(v => v.lang.startsWith('en'))
      || voices[0];
    if (preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled, ttsLang]);

  // Announce when current token changes
  useEffect(() => {
    const current = queueData?.current;
    const currentToken = current?.tokenNumber;
    
    if (currentToken && currentToken !== lastAnnouncedToken.current) {
      lastAnnouncedToken.current = currentToken;
      const room = current?.department ? `${current.department} Consultation Room` : 'the consultation room';
      const doctorDisplay = current?.doctorName ? `, Doctor ${current.doctorName}` : '';
      
      // Repeat announcement for clarity
      setTimeout(() => {
        speak(`Token ${currentToken.split('').join(' ')}${doctorDisplay}, please proceed to ${room}`);
      }, 500);
      setTimeout(() => {
        speak(`Token ${currentToken.split('').join(' ')}, please proceed to ${room}`);
      }, 6000);
    }
  }, [queueData?.current?.tokenNumber, queueData?.current?.doctorName, queueData?.current?.department, speak]);

  // Enable TTS on user interaction
  const handleEnableTTS = () => {
    setTtsEnabled(true);
    speak('Voice calling system is active');
  };

  const current = queueData?.current;
  const currentToken = current?.tokenNumber || (isLoading ? '...' : '--');
  const doctorName = current?.doctorName || '';
  const clinicName = queueData?.clinicName || 'Sanjeevani Multi-Specialty Hospital';
  const nextTokens: { tokenNumber: string; doctorName?: string; queueNumber?: number }[] = (queueData?.waiting || []).slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 p-6 md:p-10 text-white select-none">
      {/* Top Bar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 rounded-full bg-teal-500 animate-ping" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-100">{clinicName}</h1>
          </div>
          <p className="mt-1 text-sm uppercase tracking-widest text-teal-400 font-semibold">
            Central OPD Waiting Lounge • Live Token Board
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="font-mono text-3xl md:text-4xl font-bold text-stone-200">{time}</div>
          <button 
            onClick={handleEnableTTS}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all ${
              ttsEnabled 
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm' 
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
            }`}
          >
            🔊 {ttsEnabled ? 'Voice Calling: ACTIVE' : 'Click to Enable Audio'}
          </button>
        </div>
      </div>

      {/* Main Grid: Serving & Next Up */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 items-stretch">
        {/* NOW SERVING HERO CARD */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center p-8 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500" />
          
          <div className="text-xl md:text-2xl font-bold uppercase tracking-widest text-stone-400 mb-2">
            🔔 NOW SERVING
          </div>

          <div className="my-6">
            <div className="text-8xl md:text-[11rem] font-black tracking-tighter text-teal-400 font-mono drop-shadow-[0_0_35px_rgba(20,184,166,0.3)]">
              {currentToken}
            </div>
          </div>

          {current ? (
            <div className="space-y-2">
              <div className="text-2xl md:text-3xl font-bold text-stone-100">
                {current.doctorName || 'Doctor Cabin'}
              </div>
              <div className="inline-block px-4 py-1 rounded-full bg-teal-950 text-teal-300 border border-teal-800 text-sm font-semibold uppercase tracking-wider">
                {current.department || 'General Consultation'} • Room 1
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
            <h2 className="text-base font-bold uppercase tracking-wider text-stone-300 flex items-center gap-2">
              <span>📋</span> UP NEXT IN QUEUE
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-400 font-mono">
              {nextTokens.length} Waiting
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {nextTokens.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500 text-sm">
                <span>No other patients waiting in queue.</span>
              </div>
            ) : (
              nextTokens.map((t, idx) => (
                <div 
                  key={t.tokenNumber || idx}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-800/60 border border-stone-700/50 hover:bg-stone-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-stone-700 text-stone-300 text-xs font-bold flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-2xl font-bold font-mono text-stone-100">
                      {t.tokenNumber}
                    </span>
                  </div>
                  <div className="text-right text-xs text-stone-400">
                    <span className="font-medium text-teal-400">{t.doctorName || 'OPD'}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-stone-800/80 text-center text-xs text-stone-500">
            Please be seated. Your token will be called automatically.
          </div>
        </div>
      </div>
    </div>
  );
}
