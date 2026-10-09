'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { BillingStatus } from '@/lib/billing/config';
import { PLANS, formatNaira, type Plan } from '@/lib/billing/plans';

/**
 * Free next to Plus. The page is honest about state: while payments are
 * off there is no form, only the plan table and a line saying Plus is not
 * open and nothing is charged. When they open, an email starts a checkout
 * on Paystack's hosted page; card details never touch MUSE. A return with
 * ?returned=1 only says the payment is being confirmed, never "you are on
 * Plus", because confirmation comes from the server after verification.
 */

interface PlansViewProps {
  status: BillingStatus;
  returned?: boolean;
}

function PlanCard({ plan, highlight }: { plan: Plan; highlight?: boolean }) {
  return (
    <Surface
      variant="raised"
      className={cn(
        'flex h-full flex-col gap-5 p-6',
        highlight && 'border-accent/40',
      )}
      data-testid={`plan-${plan.id}`}
    >
      <div className="space-y-1">
        <h2 className="type-section-label !text-text-primary">{plan.name}</h2>
        <p className="text-2xl font-bold text-text-primary">
          {formatNaira(plan.priceNgnMonthly)}
          {plan.priceNgnMonthly ? (
            <span className="text-sm font-medium text-text-muted">
              {' '}
              / month
            </span>
          ) : null}
        </p>
        <p className="text-sm text-text-secondary">{plan.tagline}</p>
      </div>
      <ul className="space-y-2 text-sm text-text-secondary">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

type CheckoutState =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'error'; message: string };

function CheckoutForm() {
  const [email, setEmail] = React.useState('');
  const [state, setState] = React.useState<CheckoutState>({ kind: 'idle' });
  const errorId = React.useId();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState({ kind: 'sending' });
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, plan: 'plus' }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        authorizationUrl?: string;
        error?: string;
      };
      if (!response.ok || !body.authorizationUrl) {
        setState({
          kind: 'error',
          message:
            body.error || 'Checkout could not start. Nothing was charged.',
        });
        return;
      }
      window.location.assign(body.authorizationUrl);
    } catch {
      setState({
        kind: 'error',
        message: 'Checkout could not start. Nothing was charged.',
      });
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3"
      noValidate
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-text-primary">
          Email for the receipt
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={state.kind === 'error' ? errorId : undefined}
          className="h-11 w-full rounded-md border border-border-subtle bg-background px-3 text-sm text-text-primary placeholder:text-text-faint focus-ring"
          placeholder="you@example.com"
        />
      </label>
      <Button
        type="submit"
        disabled={state.kind === 'sending' || !email.includes('@')}
      >
        {state.kind === 'sending' ? 'Opening Paystack' : 'Continue to Paystack'}
      </Button>
      {state.kind === 'error' ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
      <p className="text-xs text-text-muted">
        You pay on Paystack&apos;s page in naira. MUSE never sees your card.
      </p>
    </form>
  );
}

export function PlansView({ status, returned }: PlansViewProps) {
  const plusPriced =
    PLANS.plus.priceNgnMonthly !== null && PLANS.plus.priceNgnMonthly > 0;
  const open = status.enabled && status.configured && plusPriced;

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6">
      <div className="space-y-3">
        <h1 className="type-page-title">MUSE Plus</h1>
        <p className="max-w-2xl text-lg font-medium text-text-secondary">
          Free stays free. Plus is more room for the same MUSE, paid in naira
          through Paystack. Nothing in Plus needs a Spotify account.
        </p>
      </div>

      {returned ? (
        <Surface variant="raised" className="p-5" role="status">
          <p className="text-sm text-text-primary">
            Thanks. Paystack is confirming the payment. Plus switches on only
            after MUSE verifies it on the server; this page does not claim it
            yet.
          </p>
        </Surface>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard plan={PLANS.free} />
        <PlanCard plan={PLANS.plus} highlight />
      </div>

      <Surface
        variant="base"
        className="space-y-4 p-4 sm:p-6"
        data-testid="plus-checkout"
      >
        {open ? (
          <>
            <h2 className="type-section-label !text-text-primary">
              Start Plus
            </h2>
            <CheckoutForm />
          </>
        ) : (
          <>
            <h2 className="type-section-label !text-text-primary">
              Not open yet
            </h2>
            <p
              className="text-sm text-text-secondary"
              data-testid="plus-closed"
            >
              Plus is not open yet. Nothing is charged, and no card is asked
              for. Everything on the Free plan works now.
            </p>
          </>
        )}
      </Surface>
    </div>
  );
}
