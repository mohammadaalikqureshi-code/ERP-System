import { useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Trash2 } from 'lucide-react';
import {
  useApiKeys,
  useDeleteApiKey,
  useSaveApiKey,
  useTestApiKey,
} from '@/api/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useToast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils';

/**
 * Where an administrator stores the clinic's third-party credentials.
 *
 * Keys are write-only: once saved, the value is encrypted and only a masked
 * form is ever shown again. To change one, paste a new value over it.
 */
function ApiKeysPageContent() {
  const { toast } = useToast();
  const { data, isLoading } = useApiKeys();
  const { mutateAsync: saveKey, isPending: isSaving } = useSaveApiKey();
  const { mutateAsync: deleteKey } = useDeleteApiKey();
  const { mutateAsync: testKey, isPending: isTesting } = useTestApiKey();

  const [provider, setProvider] = useState('anthropic');
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState('');
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; message: string }>>({});

  const handleSave = async () => {
    if (!secret.trim()) return;
    try {
      await saveKey({ provider, key: secret.trim(), label: label.trim() || undefined });
      setSecret('');
      setLabel('');
      toast({ title: 'Key saved', description: 'It is stored encrypted and never shown again.' });
    } catch (error: any) {
      toast({ title: 'Could not save the key', description: error.message, variant: 'destructive' });
    }
  };

  const handleTest = async (providerName: string) => {
    try {
      const result = await testKey(providerName);
      setTestResult((current) => ({ ...current, [providerName]: result }));
    } catch (error: any) {
      setTestResult((current) => ({
        ...current,
        [providerName]: { ok: false, message: error.message },
      }));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteKey(id);
    toast({ title: 'Key removed' });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const providers = [
    ...(data?.items.map((item) => ({ provider: item.provider, description: item.description })) ?? []),
    ...(data?.missingProviders ?? []),
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title="API Keys"
        description="Credentials for the AI assistant and patient messaging. Stored encrypted; never shown again after saving."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Add or replace a key
          </CardTitle>
          <CardDescription>
            Saving a key for a provider replaces whatever was there before.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="h-9 w-full rounded-md border border-stone-300 bg-transparent px-3 text-sm dark:border-stone-600"
              >
                {providers.map((item) => (
                  <option key={item.provider} value={item.provider}>
                    {item.description || item.provider}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="secret">Key</Label>
              <Input
                id="secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Paste the secret here"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Label (optional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Main clinic key"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving || !secret.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save key
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configured keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.items.length ?? 0) === 0 && (
            <p className="text-sm text-stone-500">
              No keys configured yet. The AI assistant stays switched off until one is added.
            </p>
          )}

          {data?.items.map((item) => {
            const result = testResult[item.provider];
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-4 dark:border-stone-700"
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.description || item.provider}</p>
                  <p className="font-mono text-xs text-stone-500">{item.maskedKey}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    {item.label ? `${item.label} · ` : ''}
                    used {item.usageCount} time{item.usageCount === 1 ? '' : 's'}
                    {item.lastUsedAt ? ` · last used ${formatDateTime(item.lastUsedAt)}` : ''}
                  </p>
                  {item.lastError && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" /> {item.lastError}
                    </p>
                  )}
                  {result && (
                    <p
                      className={`mt-1 flex items-center gap-1 text-xs ${
                        result.ok ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {result.ok ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {result.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(item.provider)}
                    disabled={isTesting}
                  >
                    {isTesting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Remove key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ApiKeysPage() {
  return (
    <ErrorBoundary>
      <ApiKeysPageContent />
    </ErrorBoundary>
  );
}
