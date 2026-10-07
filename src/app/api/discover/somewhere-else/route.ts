import { orchestrateSomewhereElse } from '@/lib/ai/discover-engine';
import { SomewhereElseResponseSchema } from '@/lib/validation/api-schemas';
import { runDiscoverAction } from '../action-helpers';

export const runtime = 'nodejs';

/** Section 36. A path out of the user's normal rotation. */
export async function POST(request: Request) {
  return runDiscoverAction(
    request,
    {
      scope: 'ai:discover:somewhere-else',
      limit: 8,
      fallbackError: 'Unable to plan that journey right now.',
    },
    async (userId) => {
      const data = await orchestrateSomewhereElse(userId);
      return SomewhereElseResponseSchema.parse(data);
    }
  );
}
