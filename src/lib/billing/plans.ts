/**
 * What Free and Plus mean. Every Plus benefit is built from what MUSE
 * already does without Spotify: the chat, the catalogue check, Last.fm or
 * an export on the device, and the written taste profile. Nothing here may
 * ever depend on a Spotify token, and a test keeps it that way.
 *
 * Prices are not set: the owner decides them before the flag is turned on.
 * A null price renders as "price to be announced" and the checkout refuses
 * to start, so no number is ever invented.
 */

export const PLAN_IDS = ['free', 'plus'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  /** Songs MUSE aims for in one list. */
  songsPerList: number;
  /** AI requests one visitor may make per hour. */
  requestsPerHour: number;
  /** "Your taste in words" runs per day. */
  tasteProfilesPerDay: number;
  /** Whether Plus is served while the shared daily budget rests. */
  servedWhileResting: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in Nigerian naira, or null until the owner sets one. */
  priceNgnMonthly: number | null;
  features: readonly string[];
  limits: PlanLimits;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Music recommendations without an account or card.',
    priceNgnMonthly: 0,
    features: [
      'Song lists checked against Deezer and iTunes, aiming for 8 to 12 picks',
      'Nigeria first, with the Global switch and English, Pidgin, or mix',
      'Open-in links, copy, CSV, and share',
      'Tester Profile: import Last.fm or a Spotify export and request AI taste insights',
    ],
    limits: {
      songsPerList: 12,
      requestsPerHour: 15,
      tasteProfilesPerDay: 3,
      servedWhileResting: false,
    },
  },
  plus: {
    id: 'plus',
    name: 'Plus',
    tagline: 'Planned benefits, not available yet.',
    // TODO(owner): set the monthly price in naira before PAYMENTS_ENABLED=true.
    priceNgnMonthly: null,
    features: [
      'Planned: lists of up to 20 songs',
      'Planned: higher request limits',
      'Planned: more taste insight requests',
      'Planned: access beyond the shared Free budget',
    ],
    limits: {
      songsPerList: 20,
      requestsPerHour: 60,
      tasteProfilesPerDay: Number.POSITIVE_INFINITY,
      servedWhileResting: true,
    },
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return (
    typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value)
  );
}

/** Naira for display: "NGN 1,500" or "price to be announced". */
export function formatNaira(amount: number | null): string {
  if (amount === null) return 'price to be announced';
  if (amount === 0) return 'NGN 0';
  return `NGN ${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amount)}`;
}

/** Paystack charges in kobo. */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}
