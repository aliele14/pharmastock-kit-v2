import { FileText } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';

export const metadata = { title: 'Briefing — PharmaStock' };

export default function BriefingPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Supply briefing"
        description="A deterministic, rules-based supply report — Risks, Actions, Watchlist."
      />
      <EmptyState
        icon={<FileText className="h-6 w-6" />}
        title="Coming in Phase 2"
        description="The briefing engine assembles a written report from pure-code rules (no LLM). It arrives in the next build phase alongside demand anomaly detection."
      />
    </div>
  );
}
