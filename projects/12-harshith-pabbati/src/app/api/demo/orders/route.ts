import { NextRequest, NextResponse } from 'next/server';

const DEMO_KEY = process.env.DEMO_API_KEY;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * GET /api/demo/orders
 *
 * Demo endpoint — returns a list of fictional customer orders with shipping
 * status.  Authenticate with: Authorization: Bearer <DEMO_API_KEY>
 */
export async function GET(request: NextRequest) {
  if (!DEMO_KEY) {
    return NextResponse.json({ error: 'Demo API not configured' }, { status: 503 });
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${DEMO_KEY}`) {
    return unauthorized();
  }

  return NextResponse.json({
    orders: [
      {
        id: 'ord_8821',
        customer_id: 'cust_001',
        customer_name: 'Alice Johnson',
        items: [{ sku: 'PRO-PLAN-MONTHLY', quantity: 1, price_usd: 49.0 }],
        status: 'delivered',
        placed_at: '2026-02-28T10:14:00Z',
        delivered_at: '2026-03-01T09:00:00Z',
        tracking_number: 'TRK-20260228-001',
      },
      {
        id: 'ord_8822',
        customer_id: 'cust_002',
        customer_name: 'Bob Smith',
        items: [{ sku: 'STARTER-PLAN-MONTHLY', quantity: 1, price_usd: 9.0 }],
        status: 'processing',
        placed_at: '2026-03-01T08:30:00Z',
        delivered_at: null,
        tracking_number: null,
      },
      {
        id: 'ord_8823',
        customer_id: 'cust_003',
        customer_name: 'Carol White',
        items: [
          { sku: 'ENT-PLAN-ANNUAL', quantity: 1, price_usd: 4800.0 },
          { sku: 'EXTRA-STORAGE-100GB', quantity: 2, price_usd: 40.0 },
        ],
        status: 'shipped',
        placed_at: '2026-02-15T14:00:00Z',
        delivered_at: null,
        tracking_number: 'TRK-20260215-003',
      },
    ],
  });
}
