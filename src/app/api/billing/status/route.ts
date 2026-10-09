import { NextResponse } from 'next/server';
import { billingStatus } from '@/lib/billing/config';
import { PLANS } from '@/lib/billing/plans';

export const runtime = 'nodejs';

/** Whether Plus is open, plus the plan table. No key material ever leaves. */
export function GET() {
  return NextResponse.json({ status: billingStatus(), plans: PLANS });
}
