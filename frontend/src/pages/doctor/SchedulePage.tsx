import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SchedulePage() {
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/auth/me').then(res => res.data)
  });

  // MOCK doc id fetch, assume user.id for now
  const docId = user?.id;

  const { data: schedules } = useQuery({
    queryKey: ['schedules', docId],
    queryFn: () => api.get(`/doctors/${docId}/schedules`).then(res => res.data),
    enabled: !!docId
  });

  const { data: leaves } = useQuery({
    queryKey: ['leaves', docId],
    queryFn: () => api.get(`/doctors/${docId}/leaves`).then(res => res.data),
    enabled: !!docId
  });

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between">
        <h1 className="text-3xl font-bold">My Schedule</h1>
        <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
          <DialogTrigger asChild>
            <Button>Request Leave</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request Leave</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>From</Label><Input type="date" /></div>
                <div><Label>To</Label><Input type="date" /></div>
              </div>
              <div><Label>Reason</Label><Input placeholder="E.g., Sick leave" /></div>
              <Button className="w-full">Submit Request</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Weekly Hours</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {days.map((day, i) => {
              const daySch = schedules?.filter((s: any) => s.dayOfWeek === i) || [];
              return (
                <div key={day} className="flex justify-between items-center border-b pb-2">
                  <span className="font-medium w-24">{day}</span>
                  <div className="flex-1 text-sm text-muted-foreground">
                    {daySch.length === 0 ? "Off" : daySch.map((s: any) => `${s.startTime.substring(0,5)} - ${s.endTime.substring(0,5)}`).join(', ')}
                  </div>
                  <Button variant="ghost" size="sm">Edit</Button>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Leave Requests</CardTitle></CardHeader>
          <CardContent>
            {leaves?.length === 0 ? <p className="text-muted-foreground">No leaves requested.</p> : (
              <div className="space-y-4">
                {leaves?.map((l: any) => (
                  <div key={l.id} className="flex justify-between items-center border p-3 rounded">
                    <div>
                      <p className="font-medium">{l.dateFrom} to {l.dateTo}</p>
                      <p className="text-sm text-muted-foreground">{l.reason}</p>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded text-xs ${l.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {l.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
