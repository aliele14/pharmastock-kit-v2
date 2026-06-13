import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/db/client';

export async function GET() {
  const { error } = await getServerSupabase()
    .from('suppliers')
    .select('id')
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
