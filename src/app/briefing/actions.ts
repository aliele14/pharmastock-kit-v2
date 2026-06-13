'use server';

import { getBriefingData } from '@/lib/db/queries';
import { generateBriefing, type BriefingReport } from '@/lib/domain';

export async function generateBriefingAction(): Promise<BriefingReport> {
  const input = await getBriefingData();
  const today = new Date().toISOString().slice(0, 10);
  return generateBriefing(input, today);
}
