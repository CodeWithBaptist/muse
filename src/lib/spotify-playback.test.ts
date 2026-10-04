import { describe, expect, it } from "vitest";
import {
  getSpotifyTrackUri,
  hasSpotifyPlaybackScopes,
  SPOTIFY_PLAYBACK_SCOPES,
} from "./spotify-playback";

describe("Spotify playback helpers", () => {
  it("requires all playback scopes before enabling the player", () => {
    expect(hasSpotifyPlaybackScopes(SPOTIFY_PLAYBACK_SCOPES.join(" "))).toBe(
      true,
    );
    expect(hasSpotifyPlaybackScopes("streaming user-read-private")).toBe(false);
    expect(hasSpotifyPlaybackScopes(null)).toBe(false);
  });

  it("builds a track URI only from a valid Spotify track identifier", () => {
    expect(getSpotifyTrackUri({ id: "3n3Ppam7vgaVa1iaRUc9Lp" })).toBe(
      "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",
    );
    expect(
      getSpotifyTrackUri({
        id: "ignored",
        uri: "spotify:track:3n3Ppam7vgaVa1iaRUc9Lp",
      }),
    ).toBe("spotify:track:3n3Ppam7vgaVa1iaRUc9Lp");
    expect(getSpotifyTrackUri({ id: "not-a-spotify-id" })).toBeNull();
  });
});
