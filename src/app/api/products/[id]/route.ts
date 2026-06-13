import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/client';

const UpdateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z
    .enum([
      'Antibiotics',
      'Analgesics',
      'Cardiovascular',
      'Vaccines',
      'Oncology',
      'Diabetes',
      'Respiratory',
      'Dermatology',
    ])
    .optional(),
  unit_cost: z.number().positive().optional(),
  pack_size: z.number().int().min(1).optional(),
  cold_chain: z.boolean().optional(),
  supplier_id: z.string().uuid().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id — must be a UUID' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = UpdateProductSchema.safeParse(body);
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
    .from('products')
    .update(parsed.data)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: `Could not update product: ${error.message}` }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id — must be a UUID' }, { status: 400 });
  }

  // Delete demand_history and batches first (FK constraints)
  const supabase = getServerSupabase();
  const { error: demandErr } = await supabase
    .from('demand_history')
    .delete()
    .eq('product_id', id);
  if (demandErr) {
    return NextResponse.json(
      { error: `Could not delete demand history: ${demandErr.message}` },
      { status: 500 },
    );
  }

  const { error: batchErr } = await supabase.from('batches').delete().eq('product_id', id);
  if (batchErr) {
    return NextResponse.json(
      { error: `Could not delete batches: ${batchErr.message}` },
      { status: 500 },
    );
  }

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: `Could not delete product: ${error.message}` }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
