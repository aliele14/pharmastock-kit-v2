'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Eye, FileText, Info, RefreshCw, Zap } from 'lucide-react';
import { generateBriefingAction } from '@/app/briefing/actions';
import type { BriefingReport, BriefingSection } from '@/lib/domain';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/format';

// ---------------------------------------------------------------------------
// Section metadata
// ---------------------------------------------------------------------------

const SECTION_META: Record<
  BriefingSection,
  { label: string; icon: React.ReactNode; classes: string }
> = {
  Risks: {
    label: 'Risks',
    icon: <AlertTriangle className="h-4 w-4" />,
    classes: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  },
  Actions: {
    label: 'Actions',
    icon: <CheckCircle2 className="h-4 w-4" />,
    classes: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  },
  Watchlist: {
    label: 'Watchlist',
    icon: <Zap className="h-4 w-4" />,
    classes: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  },
};

const SECTION_ORDER: BriefingSection[] = ['Risks', 'Actions', 'Watchlist'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BriefingView() {
  const [report, setReport] = useState<BriefingReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateBriefingAction();
        setReport(result);
      } catch {
        setError('Could not generate briefing — please try again.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Generate button + how-it-works toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="h-4 w-4" aria-hidden />
          )}
          {report ? 'Regenerate briefing' : 'Generate briefing'}
        </button>

        <button
          type="button"
          onClick={() => setShowHow((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted hover:text-foreground"
          aria-expanded={showHow}
        >
          <Info className="h-4 w-4" aria-hidden />
          How is this generated?
          {showHow ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      </div>

      {/* Explanation panel */}
      {showHow ? (
        <Card className="p-4">
          <div className="flex gap-3">
            <Eye className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div className="space-y-2 text-sm text-muted">
              <p className="font-medium text-foreground">Deterministic rules engine — no LLM</p>
              <p>
                This briefing is produced entirely by a typed rules table in{' '}
                <code className="rounded bg-surface-muted px-1 py-0.5 text-xs font-mono text-foreground">
                  src/lib/domain/briefing.ts
                </code>
                . Each rule is a pure function: it checks one condition against the live inventory
                snapshot and emits a sentence template with real numbers interpolated.
              </p>
              <p>
                Rules evaluated: (1) value at risk ≤30 days above threshold, (2) critical-stock
                products, (3) reorder-point products, (4) demand anomalies in the last 14 days
                (z&#8209;score &gt; 2.5σ), (5) cold-chain batches expiring within 60 days. If none fire,
                an explicit healthy-state summary is shown instead.
              </p>
              <p>
                Because the output is deterministic — given the same data, the same report is
                produced — every rule is exhaustively unit-tested and the full report is
                snapshot-tested in Vitest.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Error */}
      {error ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </Card>
      ) : null}

      {/* Report */}
      {report ? (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            Generated {formatDate(report.generatedAt)}{' '}
            {report.healthy ? (
              <span className="text-emerald-600 dark:text-emerald-400">· All clear</span>
            ) : null}
          </p>

          {SECTION_ORDER.map((section) => {
            const lines = report.lines.filter((l) => l.section === section);
            if (lines.length === 0) return null;
            const meta = SECTION_META[section];
            return (
              <div key={section} className="flex flex-col gap-2">
                <div className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.classes}`}>
                  {meta.icon}
                  {meta.label}
                </div>
                <ul className="space-y-2">
                  {lines.map((line, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-surface p-3.5 text-sm leading-relaxed text-foreground"
                    >
                      {line.text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        !isPending && (
          <Card className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <FileText className="h-6 w-6 text-muted" aria-hidden />
            <p className="text-sm font-medium text-foreground">No report yet</p>
            <p className="max-w-sm text-sm text-muted">
              Click &ldquo;Generate briefing&rdquo; to produce a written supply report from live inventory data.
              The engine is deterministic — the same data always produces the same output.
            </p>
          </Card>
        )
      )}
    </div>
  );
}
