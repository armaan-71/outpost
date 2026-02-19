'use client';

import { api, Run, Lead } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CreateRunDialog } from '@/components/CreateRunDialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusColor } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function RunDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [run, setRun] = useState<Run | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runData, leadsData] = await Promise.all([api.getRun(id), api.getLeads(id)]);
      setRun(runData);
      setLeads(leadsData);
    } catch (err) {
      logger.error('Failed to fetch run details', err);
      setError('Failed to load run details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="container mx-auto py-10 px-4 text-center">
        <h1 className="text-2xl font-bold text-destructive mb-4">Error</h1>
        <p className="text-muted-foreground mb-4">{error || 'Run not found'}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <main className="container mx-auto py-10 px-4">
        <div className="mb-8">
          <Button
            asChild
            variant="ghost"
            className="mb-4 pl-0 hover:bg-transparent hover:text-primary"
          >
            <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>

          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{run.query}</h1>
                <Badge className={getStatusColor(run.status)}>{run.status}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Run ID: <span className="font-mono">{run.id}</span> • Created on{' '}
                {new Date(run.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={loadData} title="Refresh details">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Summary Section (Placeholder for now as Run interface doesn't strictly have summary yet, but Lead does) */}

        <div className="bg-muted/30 rounded-lg border p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Discovered Leads ({leads.length})</h2>

          {leads.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">No leads found yet.</p>
            </div>
          ) : (
            <div className="rounded-md border bg-background">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[25%]">Company</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[60%]">Summary</TableHead>
                    <TableHead className="w-[5%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <TableCell className="font-medium align-top">
                        <div className="flex flex-col max-w-full">
                          <span className="text-base truncate" title={lead.companyName}>
                            {lead.companyName}
                          </span>
                          <a
                            href={`https://${lead.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-1 truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {lead.domain}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className="text-xs font-normal">
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top relative whitespace-normal">
                        <div className="flex gap-2 items-start min-w-0">
                          {lead.summary && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Sparkles className="h-4 w-4 text-purple-500 shrink-0 mt-1" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>AI Generated Summary</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          <p className="text-sm leading-relaxed line-clamp-2 wrap-break-word">
                            {lead.summary || lead.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle text-right pr-4">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
          <SheetContent className="overflow-y-auto sm:max-w-xl p-0">
            {selectedLead && (
              <>
                <SheetHeader className="p-6 border-b bg-muted/10">
                  <SheetTitle className="text-2xl flex items-center gap-2">
                    {selectedLead.companyName}
                    {selectedLead.summary && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Sparkles className="h-5 w-5 text-purple-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Enriched by AI</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-base pt-1">
                    <a
                      href={`https://${selectedLead.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      {selectedLead.domain}
                    </a>
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-8 p-6">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Status
                    </h3>
                    <Badge variant="outline" className="px-3 py-1 text-sm">
                      {selectedLead.status}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {selectedLead.summary ? 'AI Summary' : 'Description'}
                      </h3>
                      {selectedLead.summary && <Sparkles className="h-3 w-3 text-purple-500" />}
                    </div>
                    <div className="bg-muted/30 p-4 rounded-lg text-sm border leading-relaxed shadow-sm">
                      {selectedLead.summary || selectedLead.description}
                    </div>
                  </div>

                  {selectedLead.email_draft && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Email Draft
                      </h3>
                      <div className="bg-muted p-5 rounded-lg text-sm border whitespace-pre-wrap font-mono relative group">
                        {selectedLead.email_draft}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedLead.email_draft || '');
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedLead.summary && (
                    <div className="space-y-2 pt-4 border-t">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Raw Context (Search Snippet)
                      </h3>
                      <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded border font-mono">
                        {selectedLead.description}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </main>
    </TooltipProvider>
  );
}
