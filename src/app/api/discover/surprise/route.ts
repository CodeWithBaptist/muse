import { orchestrateSurprise } from '@/lib/ai/discover-engine';
import { SurpriseResponseSchema } from '@/lib/validation/api-schemas';
import { runDiscoverAction } from '../action-helpers';

export const runtime = 'nodejs';

/** Section 38. One unexpected result, with the connection explained. */
export async function POST(request: Request) {
  return runDiscoverAction(
    request,
    {
      scope: 'ai:discover:surprise',
      limit: 10,
      fallbackError: 'Unable to find a surprise right now.',
    },
    async (userId) => {
      const data = await orchestrateSurprise(userId);
      return SurpriseResponseSchema.parse(data);
    }
  );
}
