import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  useApiKeys,
  useDeleteApiKey,
  useSaveApiKey,
  useTestApiKey,
  type ApiKey,
} from '@/api/settings';
import { useAiStatus } from '@/api/ai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils';

// Which stored providers are AI assistants (verifiable with a live call) versus
// messaging keys (only checked when a message is actually sent). Mirrors
// AI_PROVIDERS on the backend.
const AI_PROVIDERS = new Set(['groq', 'anthropic']);

// Where to get each provider's key, shown as a hint under the input.
const PROVIDER_HELP: Record<string, string> = {
  groq: 'Create a key (gsk_…) at console.groq.com/keys',
  anthropic: 'Create a key (sk-ant-…) at console.anthropic.com',
  whatsapp: 'From your Meta WhatsApp Business app',
  msg91: 'From your MSG91 dashboard',
};

function statusOf(key: ApiKey): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  if (!key.isActive) return { label: 'Disabled', variant: 'secondary' };
  if (key.lastError) return { label: 'Failing', variant: 'destructive' };
  if (key.lastUsedAt) return { label: 'Working', variant: 'default' };
  return { label: 'Not tested', variant: 'secondary' };
}

function ApiKeysContent() {
  const { toast } = useToast();
  const { data, isLoading } = useApiKeys();
  const { data: aiStatus } = useAiStatus();
  const saveKey = useSaveApiKey();
  const deleteKey = useDeleteApiKey();
  const testKey = useTestApiKey();

  const [provider, setProvider] = useState('groq');
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);

  // Every supported provider, whether or not it already has a key — so the
  // Add form can also be used to rotate an existing one (upsert replaces).
  const allProviders = useMemo(() => {
    const map = new Map<string, string>();
    (data?.items ?? []).forEach((k) => map.set(k.provider, k.description || k.provider));
    (data?.missingProviders ?? []).forEach((m) => map.set(m.provider, m.description));
    return Array.from(map.entries()).map(([value, description]) => ({ value, description }));
  }, [data]);

  const handleSave = async () => {
    if (secret.trim().length < 8) {
      toast({ title: 'That key looks too short', description: 'Paste the full secret.', variant: 'destructive' });
      return;
    }
    try {
      await saveKey.mutateAsync({ provider, key: secret.trim(), label: label.trim() || undefined });
      toast({ title: 'Key saved', description: 'It is encrypted at rest and never shown again.' });
      setSecret('');
      setLabel('');
      // Immediately verify AI keys so the admin gets a real yes/no.
      if (AI_PROVIDERS.has(provider)) {
        await runTest(provider);
      }
    } catch (e: any) {
      toast({ title: 'Could not save the key', description: e.message, variant: 'destructive' });
    }
  };

  const runTest = async (p: string) => {
    setTesting(p);
    try {
      const result = await testKey.mutateAsync(p);
      toast({
        title: result.ok ? 'Key works' : 'Key check failed',
        description: result.message,
        variant: result.ok ? undefined : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteKey.mutateAsync(deleteTarget.id);
      toast({ title: 'Key removed' });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: 'Could not remove the key', description: e.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const keys = data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title="API Keys"
        description="Third-party credentials for this clinic. Secrets are encrypted at rest and never shown again after saving."
      />

      {/* Which provider the assistant is actually using right now. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" /> AI Assistant
          </CardTitle>
          <CardDescription>
            {aiStatus?.available ? (
              <>
                Active and answering with{' '}
                <span className="font-medium text-foreground">{aiStatus.provider}</span>
                {aiStatus.model ? (
                  <>
                    {' '}·{' '}
                    <span className="font-mono text-xs">{aiStatus.model}</span>
                  </>
                ) : null}
                .
              </>
            ) : (
              <>{aiStatus?.reason || 'Add an AI key below to switch the assistant on.'}</>
            )}
          </CardDescription>
        </CardHeader>
        {!aiStatus?.available && (
          <CardContent>
            <p className="text-sm text-stone-500">
              After saving a working key, turn the assistant on under{' '}
              <Link to="/admin/panels" className="text-teal-600 underline">
                Panels → AI Assistant
              </Link>
              .
            </p>
          </CardContent>
        )}
      </Card>

      {/* Configured keys. */}
      <div className="space-y-3">
        {keys.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-stone-500">
              <KeyRound className="mx-auto mb-3 h-8 w-8 text-stone-400" />
              No keys configured yet. Add one below.
            </CardContent>
          </Card>
        )}

        {keys.map((key) => {
          const status = statusOf(key);
          return (
            <Card key={key.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{key.description || key.provider}</h3>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {AI_PROVIDERS.has(key.provider) && aiStatus?.provider === key.provider && (
                      <Badge variant="outline">in use</Badge>
                    )}
                  </div>
                  {key.label && <p className="text-sm text-stone-500">{key.label}</p>}
                  <p className="font-mono text-sm text-stone-600 dark:text-stone-300">{key.maskedKey}</p>
                  <p className="text-xs text-stone-400">
                    {key.usageCount} call{key.usageCount === 1 ? '' : 's'}
                    {key.lastUsedAt ? ` · last used ${formatDateTime(key.lastUsedAt)}` : ''}
                  </p>
                  {key.lastError && (
                    <p className="flex items-start gap-1.5 text-xs text-red-600">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      {key.lastError}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runTest(key.provider)}
                    disabled={testing === key.provider}
                  >
                    {testing === key.provider ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(key)}
                    aria-label={`Delete ${key.provider} key`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add or rotate a key. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Add or replace a key
          </CardTitle>
          <CardDescription>
            Saving a provider that already has a key replaces it — there is only ever one key per
            provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a provider" />
                </SelectTrigger>
                <SelectContent>
                  {allProviders.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input
                placeholder="e.g. Main clinic key"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Secret key</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="Paste the secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <p className="text-xs text-stone-400">
              {PROVIDER_HELP[provider] || 'Paste the provider secret.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saveKey.isPending || testing !== null}>
              {saveKey.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Save key
            </Button>
            {AI_PROVIDERS.has(provider) && (
              <span className="flex items-center gap-1 text-xs text-stone-400">
                <XCircle className="h-3.5 w-3.5" /> Verified with a live call right after saving.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this API key?"
        description={`The ${deleteTarget?.description || deleteTarget?.provider} key will be deleted. Any feature that relies on it stops working until a new key is added.`}
        confirmLabel="Remove key"
        onConfirm={handleDelete}
        isLoading={deleteKey.isPending}
      />
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <ErrorBoundary>
      <ApiKeysContent />
    </ErrorBoundary>
  );
}
