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

interface RunCardProps {
  run: Run;
}

export function RunCard({ run }: RunCardProps) {
  const statusColor = useMemo(() => {
    switch (run.status) {
      case 'COMPLETED':
        return 'bg-green-500 hover:bg-green-600';
      case 'FAILED':
        return 'bg-red-500 hover:bg-red-600';
      case 'PROCESSING':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
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
          <Link href={`/runs/${run.id}`}>View Details</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
