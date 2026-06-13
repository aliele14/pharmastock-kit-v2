import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/db/client';

const CreateProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.enum([
    'Antibiotics',
    'Analgesics',
    'Cardiovascular',
    'Vaccines',
    'Oncology',
    'Diabetes',
    'Respiratory',
    'Dermatology',
  ]),
  unit_cost: z.number().positive('Unit cost must be positive'),
  pack_size: z.number().int().min(1, 'Pack size must be at least 1').default(10),
  cold_chain: z.boolean().default(false),
  supplier_id: z.string().uuid('Invalid supplier ID'),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = CreateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { data, error } = await getServerSupabase()
    .from('products')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: `Could not create product: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
