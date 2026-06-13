import { PageHeader } from '@/components/ui';
import { BriefingView } from '@/components/briefing/briefing-view';

export const metadata = { title: 'Briefing — PharmaStock' };

export default function BriefingPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Supply briefing"
        description="A deterministic, rules-based supply report — Risks, Actions, Watchlist."
      />
      <BriefingView />
    </div>
  );
}
