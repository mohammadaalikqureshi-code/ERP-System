import { usePanels, useUpdatePanel } from '@/api/settings';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useToast } from '@/components/ui/use-toast';

/**
 * Panel management: which parts of the product this clinic uses.
 *
 * Switching a panel off hides it from every user's navigation immediately.
 * It does not delete any data — turning it back on restores everything.
 */
function PanelsPageContent() {
  const { toast } = useToast();
  const { data: panels, isLoading } = usePanels();
  const { mutateAsync: updatePanel } = useUpdatePanel();

  const handleToggle = async (key: string, label: string, isEnabled: boolean) => {
    try {
      await updatePanel({ key, isEnabled });
      toast({
        title: `${label} ${isEnabled ? 'enabled' : 'disabled'}`,
        description: isEnabled
          ? 'It now appears for the staff who use it.'
          : 'It is hidden from the navigation. No data has been deleted.',
      });
    } catch (error: any) {
      toast({ title: 'Could not update the panel', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title="Panels"
        description="Choose which parts of the system this clinic uses. Changes take effect immediately."
      />

      <div className="space-y-3">
        {panels?.map((panel) => (
          <Card key={panel.key}>
            <CardContent className="flex items-start justify-between gap-6 p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{panel.label}</h3>
                  {panel.isDefault && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 dark:bg-stone-800">
                      default
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-stone-500">{panel.description}</p>
                {panel.roles.length > 0 && (
                  <p className="mt-2 text-xs text-stone-400">
                    Used by: {panel.roles.map((role) => role.replace('_', ' ')).join(', ')}
                  </p>
                )}
              </div>
              <Switch
                checked={panel.isEnabled}
                onCheckedChange={(checked) => handleToggle(panel.key, panel.label, checked)}
                aria-label={`Toggle ${panel.label}`}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function PanelsPage() {
  return (
    <ErrorBoundary>
      <PanelsPageContent />
    </ErrorBoundary>
  );
}
