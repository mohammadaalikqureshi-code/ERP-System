import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { useAiInsights, useAiStatus, useDailyDigest } from '@/api/ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, formatDateTime } from '@/lib/utils';

const KIND_LABELS: Record<string, string> = {
  consultation_summary: 'Consultation summary',
  prescription_check: 'Prescription safety check',
  lab_interpretation: 'Lab interpretation',
  daily_digest: 'Daily digest',
};

/**
 * The administrator's view of what the assistant has been doing: generate the
 * end-of-day briefing, and read back every automation that has run.
 */
function AiConsoleContent() {
  const { toast } = useToast();
  const { data: status } = useAiStatus();
  const { mutateAsync: generateDigest, isPending } = useDailyDigest();
  const { data: insights, refetch } = useAiInsights();
  const [digest, setDigest] = useState<{ content: string; stats: Record<string, any> } | null>(null);

  const handleGenerate = async () => {
    try {
      const result = await generateDigest(undefined);
      setDigest(result);
      refetch();
    } catch (error: any) {
      toast({ title: 'Could not generate the digest', description: error.message, variant: 'destructive' });
    }
  };

  if (status && !status.available) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <PageHeader title="AI Assistant" description="Automation for the clinic's daily work." />
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <Bot className="mx-auto h-10 w-10 text-stone-400" />
            <p className="font-medium">The assistant is not set up yet</p>
            <p className="text-sm text-stone-500">{status.reason}</p>
            <Button asChild>
              <Link to="/admin/api-keys">Go to API Keys</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title="AI Assistant"
        description={`Clinical automation${status?.model ? ` · ${status.model}` : ''}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> Daily operations digest
          </CardTitle>
          <CardDescription>
            A short briefing built from today's real numbers — attendance, revenue, no-shows and
            stock.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerate} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate today's digest
          </Button>

          {digest && (
            <>
              <div className="whitespace-pre-wrap rounded-lg bg-stone-50 p-4 text-sm leading-relaxed dark:bg-stone-800">
                {digest.content}
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Appointments', value: digest.stats.appointmentsTotal },
                  { label: 'Completed', value: digest.stats.completed },
                  { label: 'No-shows', value: `${digest.stats.noShowRate}%` },
                  { label: 'Revenue', value: formatCurrency(digest.stats.revenue) },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-stone-200 p-3 dark:border-stone-700"
                  >
                    <p className="text-xs uppercase tracking-wide text-stone-500">{stat.label}</p>
                    <p className="text-lg font-semibold">{String(stat.value ?? '—')}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent AI output</CardTitle>
          <CardDescription>
            Every summary, safety check and interpretation is kept, so nothing has to be
            regenerated and every suggestion stays auditable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(insights?.length ?? 0) === 0 && (
            <p className="text-sm text-stone-500">Nothing generated yet.</p>
          )}
          {insights?.map((insight) => (
            <details
              key={insight.id}
              className="rounded-lg border border-stone-200 p-4 dark:border-stone-700"
            >
              <summary className="cursor-pointer text-sm font-medium">
                {KIND_LABELS[insight.kind] || insight.kind}
                <span className="ml-2 font-normal text-stone-500">
                  {formatDateTime(insight.createdAt)}
                </span>
              </summary>
              <div className="mt-3 whitespace-pre-wrap text-sm text-stone-600 dark:text-stone-300">
                {insight.content}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AiConsolePage() {
  return (
    <ErrorBoundary>
      <AiConsoleContent />
    </ErrorBoundary>
  );
}
