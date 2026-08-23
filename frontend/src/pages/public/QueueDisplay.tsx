import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { useQueueSocket } from '@/hooks/useQueueSocket';
import api from '@/api/client';

/**
 * Waiting-room screen with TTS voice calling.
 * Open full-screen on a TV:
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

  const { data: queueData } = useQuery({
    queryKey: ['queue', 'display', clinicId, doctorId],
    queryFn: async () => {
      const { data } = await api.get('/public/queue', {
        params: { clinicId, doctorId: doctorId || undefined },
      });
      return data;
    },
    enabled: !!clinicId,
    refetchInterval: 10_000,
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
      const room = current?.department || 'the consultation room';
      const doctorDisplay = current?.doctorName ? `, Doctor ${current.doctorName}` : '';
      
      // Repeat announcement twice for clarity
      setTimeout(() => {
        speak(`Token ${currentToken.split('').join(' ')}${doctorDisplay}, please proceed to ${room}`);
      }, 500);
      setTimeout(() => {
        speak(`Token ${currentToken.split('').join(' ')}, please proceed to ${room}`);
      }, 6000);
    }
  }, [queueData?.current?.tokenNumber, speak]);

  // Enable TTS on first user interaction (browser autoplay policy)
  const handleEnableTTS = () => {
    setTtsEnabled(true);
    speak('Voice calling system activated');
  };

  if (!clinicId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-8 text-center text-white">
        <h1 className="mb-4 text-4xl font-bold">Queue Display</h1>
        <p className="max-w-xl text-xl text-stone-400">
          Open this screen with a clinic in the address, for example
          <code className="mx-2 rounded bg-stone-800 px-2 py-1 text-teal-400">
            /queue/display?clinicId=YOUR-CLINIC-ID
          </code>
        </p>
      </div>
    );
  }

  const current = queueData?.current;
  const currentToken = current?.tokenNumber || '--';
  const doctorName = current?.doctorName || '';
  const clinicName = queueData?.clinicName || 'Clinic Queue Display';
  const nextTokens: { tokenNumber: string; doctorName?: string }[] = (queueData?.waiting || []).slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col bg-black p-8 text-white">
      {/* Header */}
      <div className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-stone-400">{clinicName}</h1>
          <p className="text-lg uppercase tracking-widest text-stone-600">Queue Display</p>
          {doctorName && <p className="mt-2 text-3xl text-teal-400">{doctorName}</p>}
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl text-stone-400">{time}</div>
          <div className="mt-2 flex items-center justify-end gap-4 text-lg text-stone-500">
            <span
              className={`h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden
            />
            {isConnected ? 'Live' : 'Reconnecting…'}
            <button 
              onClick={handleEnableTTS}
              className={`ml-4 rounded-full px-4 py-1 text-sm transition-colors ${
                ttsEnabled 
                  ? 'bg-teal-900 text-teal-300 border border-teal-700' 
                  : 'bg-stone-800 text-stone-400 border border-stone-700 animate-pulse'
              }`}
            >
              🔊 {ttsEnabled ? 'Voice ON' : 'Click to Enable Voice'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Token - Large Display */}
      <div className="flex flex-1 flex-col items-center justify-center space-y-8">
        <div className="text-5xl font-medium text-stone-300 uppercase tracking-widest">Now Serving</div>
        <div className="relative">
          <div className="text-[12rem] font-bold leading-none tracking-tighter text-teal-400 animate-pulse">
            {currentToken}
          </div>
          {current && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-48 rounded-full bg-teal-500/50" />
          )}
        </div>
        <div className="text-4xl text-stone-200">
          {current
            ? `Please proceed to ${current.department || 'the consultation room'}`
            : 'Waiting for the next patient'}
        </div>
        {current?.doctorName && (
          <div className="text-2xl text-teal-400/80">
            Doctor: {current.doctorName}
          </div>
        )}
      </div>

      {/* Next in Queue */}
      <div className="mt-auto border-t border-stone-800 pt-8">
        <div className="mb-4 text-2xl uppercase tracking-widest text-stone-400">Next in Queue</div>
        <div className="flex h-28 space-x-6 overflow-x-auto">
          {nextTokens.map((item, index) => (
            <Card
              key={item.tokenNumber || index}
              className="flex min-w-[10rem] items-center justify-center border-stone-800 bg-stone-900 transition-all hover:border-teal-800"
            >
              <CardContent className="p-4 text-center">
                <div className="text-4xl font-bold text-stone-300">{item.tokenNumber}</div>
                {item.doctorName && (
                  <div className="mt-1 text-xs text-stone-500 truncate">{item.doctorName}</div>
                )}
              </CardContent>
            </Card>
          ))}
          {nextTokens.length === 0 && (
            <div className="flex items-center text-2xl italic text-stone-500">No waiting patients</div>
          )}
        </div>
      </div>
    </div>
  );
}
