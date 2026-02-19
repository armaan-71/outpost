'use client';

import { api, Run } from '@/lib/api';
import { RunCard } from '@/components/RunCard';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import { CreateRunDialog } from '@/components/CreateRunDialog';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

export default function Home() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const data = await api.getRuns();
      setRuns(data);
    } catch (err) {
      logger.error('Failed to fetch runs', err);
      setError('Failed to load runs. Please check your API configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const handleRunCreated = () => {
    loadRuns();
  };

  return (
    <main className="container mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage your lead research campaigns and view results.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadRuns}
            disabled={loading}
            title="Refresh runs"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <CreateRunDialog onRunCreated={handleRunCreated} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-20 bg-muted/50 rounded-lg border border-dashed">
          <h3 className="text-lg font-medium">No runs found</h3>
          <p className="text-muted-foreground mt-2 mb-6">
            Get started by creating your first research run.
          </p>
          <CreateRunDialog onRunCreated={handleRunCreated} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </main>
  );
}
