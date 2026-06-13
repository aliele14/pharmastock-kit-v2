import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/client';

const UpdateBatchSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD')
    .optional(),
  batch_number: z.string().min(1).max(50).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await getServerSupabase()
    .from('batches')
    .update(parsed.data)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: `Could not update batch: ${error.message}` }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await getServerSupabase().from('batches').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: `Could not delete batch: ${error.message}` }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
