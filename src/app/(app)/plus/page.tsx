import type { Metadata } from 'next';
import { PlansView } from '@/components/billing/PlansView';
import { billingStatus } from '@/lib/billing/config';

export const metadata: Metadata = {
  title: 'Plus',
  description:
    'Free stays free. MUSE Plus is more room for the same MUSE, paid in naira through Paystack when it opens.',
};

/**
 * Open to everyone. The server decides whether Plus is open from the flag
 * and the key; the page never guesses and never shows a form it cannot
 * honour.
 */
export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <PlansView status={billingStatus()} returned={params.returned === '1'} />
  );
}
