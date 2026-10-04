import { db } from "@/db";
import { spotifyAccounts } from "@/db/schema";
import { getSession } from "@/lib/session";
import { hasSpotifyPlaybackScopes } from "@/lib/spotify-playback";
import {
  getValidAccessToken,
  isSpotifyReconnectError,
} from "@/lib/spotify-tokens";
import { PlaybackStatusResponseSchema } from "@/lib/validation/api-schemas";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusResponse(
  availability: "ready" | "reconnect-required" | "disconnected" | "unavailable",
  httpStatus = 200,
) {
  return NextResponse.json(
    PlaybackStatusResponseSchema.parse({ availability }),
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store, private" },
    },
  );
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return statusResponse("disconnected");

    const [account] = await db
      .select()
      .from(spotifyAccounts)
      .where(eq(spotifyAccounts.userId, session.userId));

    if (!account) return statusResponse("disconnected");
    if (!hasSpotifyPlaybackScopes(account.scope)) {
      return statusResponse("reconnect-required");
    }

    await getValidAccessToken(session.userId);
    return statusResponse("ready");
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return statusResponse("reconnect-required");
    }

    console.error("Spotify playback status check failed.");
    return statusResponse("unavailable", 503);
  }
}
