'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Run } from '@/lib/api';
import Link from 'next/link';
import { useMemo } from 'react';

import { getStatusColor } from '@/lib/utils';

interface RunCardProps {
  run: Run;
}

export function RunCard({ run }: RunCardProps) {
  const statusColor = useMemo(() => {
    return getStatusColor(run.status);
  }, [run.status]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl font-bold truncate pr-4" title={run.query}>
            {run.query}
          </CardTitle>
          <Badge className={statusColor}>{run.status}</Badge>
        </div>
        <CardDescription>Created on {new Date(run.createdAt).toLocaleDateString()}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">
          {run.leadsCount !== undefined ? `${run.leadsCount} leads found` : 'Searching...'}
        </p>
        {run.error && (
          <p className="text-sm text-red-500 mt-2 truncate" title={run.error}>
            Error: {run.error}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/dashboard/runs/${run.id}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
