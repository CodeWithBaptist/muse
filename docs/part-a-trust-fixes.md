# Part A trust fixes: proposals for approval

Status: **APPLIED on 2026-10-05.** A1, A2, and A4 are implemented in the product. A3 is
implemented as real draft text and still carries its "Draft pending legal review" label on every
page, as required. This document is kept as the before and after record and as the evidence trail
for each claim.

Every claim below was read out of the current code, not assumed. Each proposal lists the file,
the current text, the proposed text, and the evidence that makes the proposed text true.

Section 73 of the master specification requires before and after copy for A1 and approval of
track choices for A2 before anything is committed. This document is that submission.

---

## A1. Unsupported capability claims

All six claims named in the specification are present verbatim in
`src/components/landing/LandingSections.tsx`.

### A1.1 "How MUSE works" steps (lines 10 to 30)

Step 1 is accurate and is left unchanged:

```text
Describe the vibe
Tell MUSE what you want to hear using natural language. No need for complex filters.
```

**Step 2**

```text
BEFORE
  MUSE understands
  Our AI analyzes your request and searches through millions of tracks on Spotify.

AFTER
  MUSE understands
  MUSE turns your request into real Spotify search queries, then recommends only
  tracks Spotify actually returned.
```

Why the before text fails: "searches through millions of tracks" is a catalogue size claim MUSE
cannot verify or control. It also misdescribes the mechanism, which is query based rather than a
full catalogue scan.

Evidence the after text is true, from `src/lib/ai/recommendation-engine.ts`:

- the model is asked for 1 to 8 Spotify search queries, capped by `MAX_QUERIES = 8`;
- each query is passed to `spotifyService.search(userId, query, ['track'], 8)`, a real
  `GET /v1/search` call;
- every result is validated against `SpotifyCandidateTrackSchema`;
- results are de-duplicated by Spotify track id and by a `title::artist` key;
- the ranking step must reuse an exact id from the verified candidate map, and any id that is
  not in that map is dropped with an explicit comment about rejecting invented tracks.

**Step 3**

```text
BEFORE
  Expert curation
  Receive personalized recommendations with clear explanations for each choice.

AFTER
  Explained, not guessed
  Every recommended track carries a one-line reason for why it fits what you asked for.
```

Why the before text fails: "Expert curation" implies human editors. There are none. Selection is
performed by a language model over verified Spotify candidates.

Evidence the after text is true: the ranking prompt requires "a 1-sentence Why this? reason for
each chosen track", `ExplanationSchema` enforces `reason` at 1 to 300 characters, and
`src/components/chat/TrackRow.tsx` renders it behind an inline "Why this" toggle.

**Step 4**

```text
BEFORE
  Build & sync
  Create and sync playlists directly to your Spotify account with one click.

AFTER
  Create in Spotify
  Save the selection as a playlist in your Spotify account. Nothing is created until you confirm.
```

Why the before text fails: there is no sync. MUSE creates a playlist once. Nothing keeps a
Spotify playlist updated afterwards, and the specification explicitly forbids silently modifying
an existing Spotify playlist.

Evidence the after text is true, from `src/lib/playlist-export.ts`: the reducer only reaches
`success` or `open` after the API reports creation, `spotifyUrl` is documented as "Real Spotify
playlist URL returned by the API. Never optimistic.", a `partial` status exists for incomplete
adds, and `spotifyPlaylistId` is retained specifically so "a retry never creates a second
playlist".

### A1.2 Feature list (lines 257 to 264)

The list keeps six entries so the existing layout and any test asserting on count still hold.

```text
BEFORE                              AFTER
Natural language discovery          Natural language discovery        (kept, accurate)
Spotify playlist integration        Spotify playlist creation         (precise: creates, does not sync)
Personalized AI explanations        A reason for every track          (plain language, same behaviour)
Intelligent music memory            Preferences you can view and delete
Deep genre exploration              Discovery outside your usual rotation
Cross-platform sync                 Works with your Spotify library
```

Notes on the three substantive changes:

- **`Cross-platform sync` is false and must go.** MUSE integrates with Spotify only. There is no
  second platform anywhere in the codebase.
- **`Intelligent music memory`** overstates what exists. `src/lib/ai/user-memory.ts` reads at most
  12 rows where `source = 'explicit'`, ordered by most recently updated, and only those are placed
  into a prompt. Nothing infers preferences silently. The after text matches the real control
  surface: `GET`, `PATCH` and `DELETE /api/memory` plus the settings memory manager.
- **`Deep genre exploration`** is vague marketing. The after text is what
  `src/lib/ai/discover-engine.ts` actually does: it reads top artists and top tracks, asks for
  sections including one titled "Outside your usual rotation (Exploring adjacent genres)", and
  resolves each section through real Spotify search.

Also verified while drafting: MUSE requests no `audio-features`, no `audio-analysis`, no
`/recommendations` and no `related-artists` endpoint anywhere, and `spotify-service.ts` strips
`preview_url` from responses. No claim in the after copy depends on an unverified Spotify API.

---

## A2. The sample conversation

### The defect

`src/lib/landing-sample.ts` uses the prompt:

```text
I want something like Brent Faiyaz but less sad.
```

and then shows three tracks, all by Brent Faiyaz: `Selfish`, `Trust`, `Dead Man Walking`.

That is the exact failure the specification names. A request for something *like* an artist but
*less sad* must not return only that artist, and returning three of his own tracks contradicts
the "less sad" half of the request in particular, since those are among his most melancholic
recordings.

### Recommended fix: three real tracks from three different artists

**Applied: this option, with Option 1 for durations.** The Nigerian-first alternative below was
not applied, because it rewrites landing copy rather than only fixing the track list, and it
remains available as a separate proposal.

Keep the existing prompt. Keep the `Sample` label. Keep the disclaimer that the demo never
contacts Spotify or OpenAI. Add no new animation.

| # | Track | Artist | Verified length | Sources agreeing |
|---|-------|--------|-----------------|------------------|
| 1 | Get You (feat. Kali Uchis) | Daniel Caesar | 4:37 | Wikipedia, Apple Music |
| 2 | I Want You Around | Snoh Aalegra | 3:32 | Wikipedia, Apple Music, JioSaavn |
| 3 | Over | Lucky Daye | 3:25 single, 3:27 album | Wikipedia, album tracklist |

Why these fit the request: all three sit in the same alternative R&B space as Brent Faiyaz, with
warm vocal-led production, but they are romantic and easy rather than bleak. Three distinct
artists satisfies "at least two artists" with room to spare.

### The duration problem, and the honest way to handle it

The current file invents its durations (`225_000`, `192_000`, `187_000`). The specification
forbids inventing durations, so they cannot simply be swapped for other invented numbers.

Two honest options:

**Option 1, recommended: omit the duration from the sample entirely.**

This is safe with no component changes. `formatTrackDuration` in `src/hooks/use-now-playing.tsx`
already returns `null` when `durationMs` is absent or not positive, `duration_ms` is optional on
the `TrackRow` track prop, and TrackRow renders the label inside a fixed `w-10` slot that is
`hidden` below the `sm` breakpoint. Omitting it therefore produces an empty reserved slot on
desktop and nothing at all on mobile, with no layout shift and no invented metadata.

**Option 2: show lengths, but accept they are not Spotify's.**

`api.spotify.com` is unreachable from this workspace, so Spotify's own `duration_ms` cannot be
confirmed here. The table above is corroborated by multiple public sources but those sources
already disagree with each other by one to two seconds, and Spotify may differ again. If you
prefer to show times, the values should be resolved from Spotify on your machine before they are
committed, not taken from this table.

### Alternative, if you want the landing demo to be Nigerian first

Section 4 makes Nigerian-first examples a core requirement, and section 25 lists
`Late night Afrobeats` as a suggested prompt. This is a larger change than A2 strictly requires,
because it rewrites landing copy rather than only fixing the track list, so it is offered
separately rather than folded in.

Prompt: `Late night Afrobeats.`

| # | Track | Artist | Verified length | Sources agreeing |
|---|-------|--------|-----------------|------------------|
| 1 | Essence (feat. Tems) | Wizkid | 4:08 | Wikipedia, MusicGateway |
| 2 | Free Mind | Tems | 4:07 | Wikipedia, Deezer, Wikiwand |
| 3 | Soso | Omah Lay | 3:03 | Wikipedia, Apple Music, SongBPM |

One caveat worth stating plainly: `Soso` is a song about depression and anxiety. It suits a late
night, low tempo Afrobeats set sonically, but if you want the demo to read as uplifting it should
be swapped for a third track of your choosing. I did not substitute one on my own, because I
could not verify a replacement to the same standard inside this workspace.

The `playlistName` should also change if this option is taken. `Late night drive` pairs oddly
with `Late night Afrobeats`. A neutral name such as `Late night` avoids the collision.

---

## A3. Legal drafts

`src/app/privacy/page.tsx`, `src/app/terms/page.tsx` and
`src/app/spotify-attribution/page.tsx` all currently render `LegalPlaceholder` with bracketed
prompts. The drafts below are written from observed behaviour only.

**All three must stay marked as drafts pending legal review.** Nothing here is legal advice, and
the attribution page in particular cannot be finalised without reading Spotify's current Design
and Branding Guidelines against a real deployment.

### A3.1 Privacy draft

```text
DRAFT. Requires legal review before publication.

What MUSE collects

When you connect Spotify, MUSE stores your Spotify user id, display name, email address and
avatar image URL. These come from the Spotify /v1/me endpoint.

When you use MUSE, it fetches listening data from Spotify on your behalf: your top artists, your
top tracks, your recently played tracks, your saved tracks, your saved albums and your playlists.
MUSE also stores the messages you send, the recommendations it returns with their reasons, any
preferences you explicitly save, and playlists you create inside MUSE.

MUSE does not run any analytics, advertising or tracking software. No third party analytics
provider is installed. No error monitoring service is installed.

Spotify permissions MUSE requests

user-read-private, user-read-email, user-top-read, user-read-recently-played,
playlist-modify-public, playlist-modify-private, user-library-read,
user-read-playback-state, user-modify-playback-state.

How your Spotify tokens are stored

Access and refresh tokens are encrypted at rest with AES-256-GCM using a server side key. They
are never returned to your browser, never written to logs, and never sent to any AI provider.

What is sent to the AI provider

MUSE uses OpenAI, model gpt-4o-mini, to interpret your request, to rank verified Spotify
candidates and to write the one line reason for each recommendation. Each request may include:
your message after sanitisation; up to five of your top artist names; up to five of your top
track names; up to twelve preferences you have explicitly saved; and the list of candidate tracks
Spotify search returned, as id, title, artist and album name.

Your email address, avatar, Spotify tokens and full listening history are not sent to OpenAI.

Your sign-in session

MUSE uses a single httpOnly cookie named muse_session with SameSite=Lax. It is marked Secure in
production and expires after 30 days.

What happens when you disconnect Spotify

Disconnecting deletes your stored Spotify tokens, recommendations, music profile insights,
conversations and their messages, and any playlists and playlist tracks MUSE created for you.

Disconnecting currently RETAINS your MUSE account identity (Spotify id, display name, email,
avatar URL), any preferences and memories you saved, and your active MUSE session.

This retention is narrower than Spotify's Developer Policy requires, which asks for deletion of
a user's personal data and no further processing after disconnection. It is recorded as an open
compliance item and must be remediated before public release.

What happens when you delete your account

Deleting your account removes your identity record along with every related row: Spotify tokens,
conversations and messages, playlists and playlist tracks, recommendations, music profiles,
preferences and memories. Your session is ended and the associated rate limit counters are
cleared. This happens in a single database transaction.

Your controls

In Settings you can view, edit and delete each saved preference, clear them together, export
your MUSE data, disconnect Spotify, or delete your account.

Data sent to Spotify

MUSE reads your profile and library, searches the catalogue, creates playlists you ask for, and
sends playback commands to your own Spotify devices. MUSE does not stream or store audio.
Preview URLs returned by Spotify are discarded rather than stored or played.

Contact

[Placeholder: a real privacy contact address must be added before publication.]
```

### A3.2 Terms draft

```text
DRAFT. Requires legal review before publication.

MUSE is a music discovery companion that works on top of Spotify. It is not a streaming service
and it does not host or play audio itself.

Your Spotify account

To use the music features you must connect a Spotify account and grant the permissions listed in
our Privacy notice. You are responsible for complying with Spotify's own terms. Playback of full
tracks through Spotify requires a Spotify Premium account. Where Premium is unavailable, MUSE
offers an Open in Spotify action instead and does not present controls that cannot work.

What MUSE does with your requests

MUSE interprets your request, builds Spotify search queries, and recommends only tracks that
Spotify search actually returned. Recommendations are generated with the assistance of a large
language model and may be wrong, incomplete or not to your taste. Each recommendation includes a
short explanation, which is generated text and not a statement of fact about the recording.

Playlists

MUSE creates a playlist in your Spotify account only after you confirm the action. If some tracks
cannot be added, MUSE reports the playlist as partially created and lists what failed. It never
reports a failed creation as a success, and it never modifies an existing Spotify playlist
without your explicit confirmation.

Saved preferences

MUSE can store preferences you save and reuse them in later recommendations. You can view, edit,
delete or clear them at any time in Settings.

Availability

MUSE depends on Spotify and on an AI provider. When either is unavailable, misconfigured or rate
limited, MUSE reports that state plainly rather than substituting invented content. Some
features show an explicit unavailable state until the relevant credential is configured.

Acceptable use

Do not attempt to circumvent rate limits, probe the service for other users' data, or use MUSE
to harvest catalogue data at scale.

No warranty

MUSE is provided as is. Music availability, catalogue metadata and playback depend on Spotify
and on your account and region.

Limitation of liability and governing law

[Placeholder: must be completed by counsel for the intended jurisdictions.]

Changes and contact

[Placeholder: add a real contact address and the process for notifying users of changes.]
```

### A3.3 Spotify attribution draft

The specification requires listing every screen that displays Spotify metadata or artwork. These
are the surfaces found in the current code:

| Surface | File | Spotify content shown |
|---|---|---|
| Chat recommendation rows | `src/components/chat/TrackRow.tsx` | album artwork, track title, artist names, duration |
| Playlist draft preview | `src/components/chat/PlaylistPreview.tsx` | track titles, artists, album artwork |
| Now Playing | `src/components/shell/NowPlaying.tsx` | artwork, title, artist, progress |
| Mobile navigation | `src/components/shell/MobileNav.tsx` | current track metadata |
| Sidebar | `src/components/shell/Sidebar.tsx` | user avatar and display name |
| Library tabs | `src/components/library/LibraryContent.tsx` | artwork, titles, artists for recent, top, saved tracks, saved albums, playlists |
| Discover sections | `src/components/discover/DiscoverSection.tsx` | artwork, titles, artists |
| Playlists | `src/app/(app)/playlists/page.tsx` | playlist artwork, names, track metadata |
| Profile | `src/app/(app)/profile/page.tsx` | top artist names, listening derived insights |
| Shared artwork transitions | `src/components/motion/SharedArtwork.tsx` | album artwork between contexts |

Outbound links already point at real Spotify destinations: `open.spotify.com/playlist/...` from
the playlists page and export flow, `open.spotify.com/{track|album|artist|playlist}/...` from
Library, and `open.spotify.com/track/...` from Now Playing. The track URL helper validates a
22 character Spotify id before producing a link, so malformed ids cannot generate a dead link.

```text
DRAFT. Cannot be finalised inside this workspace.

Attribution wording
[Placeholder: insert the approved wording from Spotify's current Design and Branding Guidelines.]

Brand asset
[Placeholder: insert the approved asset and confirm required size, colour and clear space.
Spotify's guidelines specify exact assets and treatments; a substitute must not be drawn.]

Placement
Every surface in the table above displays Spotify metadata or artwork and needs attribution
placed per the current guidelines. This must be confirmed against a running deployment.

Links to Spotify
Metadata and artwork link to the corresponding Spotify destination on the surfaces listed above.
Verify that each surface the guidelines cover actually links, and that no surface links to a
destination the guidelines do not permit.
```

---

## A4. Connect Spotify honesty

Not one of the four numbered items, but it is the same class of problem and worth recording.

`src/components/landing/Hero.tsx` renders **Connect Spotify** as a normal enabled button that
navigates to `/api/auth/spotify`. That route returns HTTP 503 with the JSON body
`{"error":"Spotify login is not configured yet."}` when `SPOTIFY_CLIENT_ID` or
`SPOTIFY_REDIRECT_URI` is missing.

So the button is genuinely wired and works when credentials exist, but when they do not, the
visitor is taken to a bare JSON error page. That is a nonfunctional button that looks functional.

There is no endpoint that exposes Spotify configuration state to the client. `/api/ai/status`
does this for the AI key and returns `{"connected":false,"code":"AI_NOT_CONNECTED"}`, which is
the honest pattern to copy.

Applied fix: `src/app/page.tsx` reads the same configuration the authorize route checks and
passes a boolean to `Hero`. When Spotify is not configured the action renders disabled, keeps the
"Connect Spotify" label, and is described by a visible line reading "Spotify connection is not
configured yet." No new endpoint and no client side fetch, so there is no intermediate state
where the action looks enabled. The working OAuth path is unchanged.

Two tests that encoded the old behaviour were replaced, and `playwright.config.ts` now supplies
placeholder Spotify credentials to the test web server so the OAuth redirect can still be
exercised. That Playwright change is unverified here, because browser downloads are blocked in
this workspace.

---

## Items deliberately not touched

- No landing animation is added or altered, per section 73 A2.
- The hero is currently centred, while sections 13 and 22 ask for left aligned asymmetric
  editorial composition. That is a Phase 3 design concern, not a trust fix, so it is recorded
  here rather than changed.
- `/login` and `/callback` from section 21 return 404. The app uses `/api/auth/spotify` and
  `/api/auth/spotify/callback`. Recorded as a route deviation for the architecture decision.
- `/playlists/:id` from section 21 does not exist as a page. Only `/playlists` is implemented.
