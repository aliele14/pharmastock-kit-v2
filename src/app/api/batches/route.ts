import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/client';

const CreateBatchSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  batch_number: z.string().min(1, 'Batch number is required').max(50),
  quantity: z.number().int().min(0, 'Quantity cannot be negative'),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD'),
  received_at: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Received date must be YYYY-MM-DD')
    .optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const payload = {
    ...parsed.data,
    received_at: parsed.data.received_at ?? new Date().toISOString().slice(0, 10),
  };

  const { data, error } = await getServerSupabase()
    .from('batches')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: `Could not create batch: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
