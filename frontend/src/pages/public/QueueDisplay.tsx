import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { useQueueSocket } from '@/hooks/useQueueSocket';
import api from '@/api/client';

/**
 * Waiting-room screen. Meant to be opened full-screen on a TV:
 *   /queue/display?clinicId=<uuid>&doctorId=<uuid>
 *
 * It keeps itself current from the queue WebSocket and re-polls once a minute
 * as a safety net if the socket drops.
 */
export default function QueueDisplay() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get('clinicId') || '';
  const doctorId = searchParams.get('doctorId') || '';

  const [time, setTime] = useState(() => new Date().toLocaleTimeString());

  const { isConnected } = useQueueSocket({ clinicId, doctorId });

  // The public endpoint, not the staff one: this screen has nobody signed in,
  // and it must never receive patient names.
  const { data: queueData } = useQuery({
    queryKey: ['queue', 'display', clinicId, doctorId],
    queryFn: async () => {
      const { data } = await api.get('/public/queue', {
        params: { clinicId, doctorId: doctorId || undefined },
      });
      return data;
    },
    enabled: !!clinicId,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

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
  const nextTokens: string[] = (queueData?.waiting || [])
    .slice(0, 3)
    .map((appointment: { tokenNumber: string }) => appointment.tokenNumber);

  return (
    <div className="flex min-h-screen flex-col bg-black p-8 text-white">
      <div className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-stone-400">{clinicName}</h1>
          <p className="text-lg uppercase tracking-widest text-stone-600">Queue Display</p>
          {doctorName && <p className="mt-2 text-3xl text-teal-400">{doctorName}</p>}
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl text-stone-400">{time}</div>
          <div className="mt-2 flex items-center justify-end gap-2 text-lg text-stone-500">
            <span
              className={`h-3 w-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden
            />
            {isConnected ? 'Live' : 'Reconnecting…'}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center space-y-12">
        <div className="text-6xl font-medium text-stone-300">NOW SERVING</div>
        <div className="text-[12rem] font-bold leading-none tracking-tighter text-teal-400">
          {currentToken}
        </div>
        <div className="text-5xl text-stone-200">
          {current
            ? `Please proceed to ${current.department || 'the consultation room'}`
            : 'Waiting for the next patient'}
        </div>
      </div>

      <div className="mt-auto border-t border-stone-800 pt-12">
        <div className="mb-6 text-2xl uppercase tracking-widest text-stone-400">Next in Queue</div>
        <div className="flex h-32 space-x-8">
          {nextTokens.map((token, index) => (
            <Card
              key={token || index}
              className="flex w-48 items-center justify-center border-stone-800 bg-stone-900"
            >
              <CardContent className="p-0 text-5xl font-bold text-stone-300">{token}</CardContent>
            </Card>
          ))}
          {nextTokens.length === 0 && (
            <div className="text-2xl italic text-stone-500">No waiting patients</div>
          )}
        </div>
      </div>
    </div>
  );
}
