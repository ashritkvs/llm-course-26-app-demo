import { NextRequest, NextResponse } from 'next/server';

const DEMO_KEY = process.env.DEMO_API_KEY;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * GET /api/demo/customers
 *
 * Demo endpoint — returns a list of fictional customers with plan and usage
 * information.  Authenticate with: Authorization: Bearer <DEMO_API_KEY>
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
    customers: [
      {
        id: 'cust_001',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        plan: 'Pro',
        status: 'active',
        usage_this_month: { api_calls: 8420, storage_gb: 12.4 },
        renewal_date: '2026-04-01',
      },
      {
        id: 'cust_002',
        name: 'Bob Smith',
        email: 'bob@example.com',
        plan: 'Starter',
        status: 'active',
        usage_this_month: { api_calls: 340, storage_gb: 1.2 },
        renewal_date: '2026-03-15',
      },
      {
        id: 'cust_003',
        name: 'Carol White',
        email: 'carol@example.com',
        plan: 'Enterprise',
        status: 'active',
        usage_this_month: { api_calls: 54300, storage_gb: 210.8 },
        renewal_date: '2026-06-30',
      },
    ],
  });
}
