# MUSE decision log

Meaningful architectural and product decisions, newest first. Each entry records the decision, why it was made, the alternatives considered, the impact, and the date. Add an entry before making a change that would be expensive to reverse.

---

## 2026-10-09: The interface is quiet: no celebration effects, no sounds, one flat vibe tint, plain loading lines

**Decision**
The decorative layer added on 2026-10-09 (below) is cut back. Gone: the notes burst and arrival chime when a list lands, the spinning vinyl with the track art on its label, the tilting rows, the chip ripple and magnetic lean, the word by word reveal of replies, the pulsing beat bars in the list header, the floating equalizer on the empty chat, the three drifting blurred glows, and the Sound setting with the Web Audio synth behind it. In their place: cover art from Deezer or iTunes in a plain square, or the first letter of the title when neither returned art (`src/components/chat/TrackArt.tsx`); replies rendered as text; a CSS-only press dip on chips (`.muse-press`) with the tap haptic kept; a single flat tint at the top of the page that takes the colour of the last prompt and fades in over 1.2 seconds (`VibeBackdrop`, `vibe-palette.ts` now returns one `tint`); and loading lines that say what is happening ("Reading your request", "Finding tracks", "Checking the catalogue", "Writing the reply"; Pidgin "Dey read wetin you type", "Dey find the tracks", "Dey check the catalogue", "Dey write the reply"), with no rotating prompt-specific lines. Sparkle icons that stood for "AI" are replaced by a key icon where a key is missing and a compass on the taste section. The empty chat headline is "Say the vibe." rather than a question. The Display menu keeps theme and Lite; `muse.ui.prefs.v1` drops the `sound` field and older stored values are simply ignored.

**Why**
The owner's override brief: the product must not look or read generated. Confetti, sparkles, sound effects by default, looping decorative motion, blurred blobs, and filler copy are the tells. Motion that remains has a job: the equalizer only runs while a request or a track is really in progress, chips press and rise, a new tint says the mood changed, and nothing loops for decoration. Real album art replaces stock-looking vinyl because it is the one image the visitor actually cares about. Removing the sound setting rather than hiding it keeps the bundle and the preference schema honest.

**Alternatives considered**
Keeping the effects behind Lite mode: rejected, the default experience is what gets judged. Keeping sound off by default but available: rejected, it added a Web Audio module and a setting nobody asked for. A soft vignette instead of a top tint: rejected, it darkened text edges on phones.

**Impact**
- Deleted: `NotesBurst`, `BeatVisualizer`, `VinylDisc`, `WordReveal`, `RippleLayer`, `celebrate-store.ts`, `ui-sound.ts`, `word-reveal.ts`, `use-ripple`, `use-magnetic`, `use-tilt`, and their tests. `ThinkingIndicator` loses `getContextualLoadingMessages`, `prompt`, and `intervalMs`.
- Server stage names in `OPEN_CHAT_STAGES` changed, so anything matching on the old strings has to be updated.
- Vibe CSS variables are now `--vibe-tint` and `--vibe-strength` only.

---

## 2026-10-09: The landing and the legal pages describe the product that ships, and counters never hold an IP

**Decision**
The landing no longer says MUSE searches Spotify or creates playlists in a Spotify account; its demo copies a list and shows the open-in chips through an inert `SampleListActions` instead of walking a Create in Spotify control, and the landing quality test fails on the old claims. Privacy, Terms, and the attribution page were rewritten from the code paths of the no-account product: every browser storage key, every cookie with its lifetime, what goes to OpenAI and what never does, Deezer and the Apple iTunes Search API, the optional Last.fm import and the browser-only export upload, the deletion path, NDPA 2023 rights and the NDPC, cross-border processing, and a testers-only section for Spotify. The attribution page keeps its route, says Spotify is not needed, and names every other service with a no-endorsement line. Rate-limit counter keys now hold a peppered SHA-256 hash of the IP rather than the address. Operator and contact live in `src/lib/legal.ts`; governing law, jurisdiction, and the database provider remain marked placeholders.

**Why**
The brief asked that the landing stop claiming Spotify features the public cannot use and that the legal pages cover what is actually stored and sent. Writing the pages from the code (and testing that the storage keys and scopes on the page match the source) keeps them honest as the code changes. Hashing the IP was the cheapest way to make the privacy statement about counters true in the strongest form. Legal choices that are the owner's or a lawyer's (law, courts, the children rule, NDPC registration, API attribution requirements) are flagged, not guessed.

**Alternatives considered**

- Deleting the attribution page: Spotify still appears for testers and in an open-in link, so the page stays and now covers the other services too.
- Embedding Deezer, Apple, and Spotify logos now: the owner will supply logo files; names in text are enough until the brand terms are checked.
- Leaving raw IPs in counters: simpler, but then the policy would have to say the server stores addresses.

**Impact**

- `src/lib/legal.ts` is the single place for the operator identity.
- `getClientIdentifier` output changed shape (`ip:<hash>`); `clientIp()` is the only raw-address reader and Turnstile uses it.
- Before publishing: fill the placeholders, add a payments section when Plus opens, and have the pages reviewed by a lawyer.

---

## 2026-10-09: Payments are a Paystack scaffold in naira behind one flag that stays off

**Decision**
MUSE gains a `/plus` page, a plan table (Free, Plus), a thin Paystack client, and two routes (`POST /api/billing/checkout`, `POST /api/billing/webhook`), all behind `PAYMENTS_ENABLED`. The flag is off: every billing route answers 503 `PAYMENTS_DISABLED` before reading a body, Paystack is never called, the page shows the plans and says "Plus is not open yet. Nothing is charged.", and the Plus price is `null` so that even with the flag on the checkout refuses with `PRICE_NOT_SET` until the owner sets a number. Entitlements are a pure function returning `free`. Free is today's MUSE; Plus is longer lists, more hourly room, unlimited taste profiles, and service while the shared budget rests. No Plus benefit depends on Spotify, and a test fails if the word appears in the Plus plan. The registrations, keys, legal text, and code TODOs needed before the flag flips are listed in `docs/PAYMENTS.md`.

**Why**
The brief asked for a payments scaffold with no real payments. Putting the refusal before body parsing, and the price before the Paystack call, means the scaffold cannot charge by accident in any configuration. Paystack was the owner's choice; its hosted page keeps card data off MUSE entirely, and its webhook signature is an HMAC of the raw body with the secret key, which the route checks in constant time before anything else. The identity question (a paid visitor needs an identity that is not Spotify) is the real design decision, and it is deferred rather than guessed, which is also why no schema is added yet.

**Alternatives considered**

- Flutterwave: equally viable in naira; the owner chose Paystack.
- Inline popup with a public key: needs a client script and a public key for no gain over the hosted page.
- Adding plan columns to `users` now: would tie payment identity to Spotify accounts, which the brief forbids.

**Impact**

- New env names (values never in the repo): `PAYMENTS_ENABLED`, `PAYSTACK_SECRET_KEY`. Nothing to set on Vercel yet.
- `/plus` is an open path in the shell; the open-path test covers the page, both routes, and the plan table.
- Terms and Privacy need a payments section before launch (flagged in `docs/PAYMENTS.md`, lawyer review).

---

## 2026-10-09: The interface is alive on transform and opacity, and every effect answers to one effects level

**Decision**
MUSE keeps its brand, tokens, fonts, and the existing animation system (beat clock, equalizer bars, hero canvases, page transitions) and adds a layer of life on top: a living background whose three glows recolour to the last prompt through a pure keyword palette (`src/lib/vibe-palette.ts`) and crossfade between palettes as layers; vibe chips that rise in turn, ripple where pressed, lean toward a mouse pointer, and buzz for ten milliseconds through `navigator.vibrate`; vinyl track cards with Deezer or iTunes cover art on the label, an entry roll, a hover spin, and a three degree tilt on fine pointers; "why this" lines typed word by word, each row a beat after the last; a header visualizer that pulses to the shared 96 BPM clock while on screen; a one-shot burst of inline SVG notes when a fresh playlist lands; and waiting lines that follow the language toggle, including Naija Pidgin ("Dey cook your playlist...") and a mixed set. Every effect moves only `transform` and `opacity`, writes pointer-driven transforms straight to the element inside the event rather than through React state, and the heavy pieces (the burst) load through `next/dynamic` only when needed.

All of it answers to one effects level resolved in `src/lib/ui-prefs.ts`: `none` when the system asks for reduced motion, `lite` when the visitor chose Lite or, on auto, when the browser reports Save-Data, a 2G class connection, or two gigabytes of memory or less, else `full`. The level is stamped on `<html data-effects>` by a tiny inline head script before the first paint, together with `data-theme`, from a device-only preference (`localStorage` key `muse.ui.prefs.v1`: theme dark or light, Lite auto, on, or off, sound on or off). A Display menu, open to everyone in the sidebar, the phone header, and the landing header, exposes the choices (the Sound one was removed later the same day, see the entry above). Dark remains the default and is never swapped for the OS setting; the light theme re-tunes every token so each text role clears WCAG AA on both the page and the surface, with the accent darkened to `#3F7A00` so it still reads as text. Sound is synthesised with the Web Audio API, off until switched on, and the first context is created inside that switch-on gesture.

**Why**
The brief asked for a page that feels alive on mid-range Android phones with expensive data. Compositing only `transform` and `opacity` keeps the work off the main thread; skipping decorative layers outright under Lite (the backdrop and burst render nothing, the canvases go still, the typed reveals become instant) means a slow phone or a Save-Data connection does less, not merely the same work hidden. One shared level stops each effect inventing its own rule. Dark by default matches the brand and the OLED screens most of the audience carries, but a readable light option is an accessibility need, not a style. Vibration and sound are both courtesies that must never be a surprise, so the buzz is tied to a tap and the sound stays off until asked for.

**Alternatives considered**

- A WebGL or canvas background: richer, but a persistent GPU context and shader compile on a budget phone costs more than three blurred circles, and it cannot be switched off by a stylesheet rule.
- Scroll parallax on the chat: the chat scrolls inside its own container and the backdrop already drifts; a scroll-linked layer adds a listener per frame for little gain, so it was left out on purpose.
- Following `prefers-color-scheme` for the default: it would flip the brand to light for many Android users who never asked; the choice is offered instead.
- Confetti as emoji glyphs: fonts differ per device and emoji are banned in this product, so the burst is SVG paths and dots.
- Dropping the vinyl art to save requests: the covers are the 56 px thumbnails the verification already found, lazily loaded, so the cost is small and the recognition value is high.

**Impact**

- New files: `src/lib/ui-prefs.ts`, `src/lib/ui-prefs-store.ts`, `src/hooks/use-ui-prefs.ts`, `src/components/shell/DisplayMenu.tsx`, `src/lib/ui-sound.ts`, `src/lib/haptics.ts`, `src/lib/vibe-palette.ts`, `src/lib/vibe-store.ts`, `src/lib/celebrate-store.ts`, `src/hooks/{use-vibe,use-ripple,use-magnetic,use-tilt}.ts`, `src/components/motion/{VibeBackdrop,NotesBurst,BeatVisualizer}.tsx`, `src/components/chat/VinylDisc.tsx`, `src/components/ui/RippleLayer.tsx`. `src/lib/design-tokens.ts` carries `lightColors`, and the token test checks the light block and its contrast.
- The open-path test lists the new components, so none of them may ever import Spotify or auth.
- The PWA manifest gains `id`, `scope`, `start_url: /chat`, `lang: en-NG`, and maskable 192 and 512 icons generated from the existing mark; `appleWebApp` metadata lets iOS add it to the home screen. No service worker is added: offline chat would mean faking results.
- Region: the Vercel functions stay in `iad1` (default) because the database and the OpenAI endpoint are in the US East region; moving the functions to `cdg1` or `lhr1` would put every database round trip across the Atlantic. The lower-latency path for Lagos is the edge-cached static assets Vercel already serves from its CDN, and, once Upstash is configured, choosing an EU region for it so the rate-limit round trip is short. If the database ever moves to the EU, set `regions: ["cdg1"]` in a `vercel.json` at that time.
- Lighthouse could not be run in the build sandbox (no browser). The checks that matter for the brief are documented for the owner to run: `npx lighthouse <preview-url>/chat --form-factor=mobile --preset=perf --view`, once with the default and once after choosing Lite in the Display menu.

---

## 2026-10-08: Personalisation comes from Last.fm or a Spotify data export, is read on the device, and lives only in the browser

**Decision**
A visitor brings their listening in one of two ways, neither needing an account. A public Last.fm username goes to `POST /api/taste/lastfm`, where the server calls Last.fm with `LASTFM_API_KEY` (top artists and top tracks over six months, plus recent plays) and returns a compact snapshot; the username is not stored and the key never leaves the server. A Spotify data export (the ZIP Spotify emails, or the `StreamingHistory` JSON files inside it) is opened in the browser: both layouts are recognised, podcasts and anything under thirty seconds are skipped, and only the summary (top artists, top tracks, recent plays, date range, play count) is kept. The ZIP reader (`fflate`) loads only when a ZIP is chosen. The snapshot is stored in `localStorage` (`muse.taste.v1`), travels with each chat request trimmed to ten items per list, and is posted to `POST /api/taste/insights` when the visitor asks for "Your taste in words". The server validates it, frames it as data inside `<listener_taste>`, and never writes it anywhere. The Profile page is now open to everyone and is where both sources, the snapshot, and the written profile live; signed-in testers keep an opt-in button that writes from the Spotify account they connected.

**Why**
The brief asked for Last.fm plus a server-parsed export with the raw file not stored. The product owner chose on-device parsing instead on 2026-10-08, for three reasons: Vercel caps request bodies at 4.5 MB and extended history exports are often far larger; the extended layout carries IP addresses and device strings that should not transit MUSE at all; and uploading tens of megabytes on Nigerian mobile data is a real cost when a few kilobytes of summary do the job. Browser-only storage matches the earlier rule that the server keeps counters only for people without an account. Opening the Profile page keeps "Your taste in words" where the landing page says it is, without a login.

**Alternatives considered**

- Server-side parsing as written: a 4.5 MB ceiling, the sensitive fields in transit, and a second code path to keep honest.
- Saving snapshots for signed-in testers in `music_profiles`: a table write and a deletion path for a feature testers can reproduce in one tap.
- A "Personalise" sheet inside the chat instead of the Profile page: hides the feature from the navigation and duplicates the profile view.
- Reading `YourLibrary.json` (saved tracks) too: a useful signal, left out to keep the first version small; the parser is a pure function and can grow.

**Impact**

- New env name in `.env.example`: `LASTFM_API_KEY` (server only, optional). Without it the Profile page says Last.fm import is not switched on; the export path still works.
- New routes: `POST /api/taste/lastfm` (10 per minute per IP) and `POST /api/taste/insights` (same protections as the chat: origin check, 15 per minute per IP, human check when on, daily AI budget).
- The chat request schema gains an optional `taste` field; both chat paths pass it to the playlist prompt and the reply prompt, and the open path stops telling visitors it has no access to their listening when they brought it. `listener_taste` was added to the prompt sanitiser's stripped tags.
- Last.fm's terms ask for a link back where its data is shown; the snapshot card links to the profile. The privacy page needs a paragraph on both sources (Task 10).
- Guests now see two tabs, Chat and Profile. Discover, Library, and Playlists stay tester-only.

---

## 2026-10-08: Spotify sign-in and Create in Spotify are for testers only, and the no-account path is proven never to touch Spotify

**Decision**
Spotify sign-in is hidden from the public and refused on the server unless the visitor is a tester. There are two ways to be one, both set on the server: `TESTER_KEY` (a secret of at least 16 characters that a visitor types on `/login`; a correct key sets an HttpOnly `muse_tester` cookie holding an HMAC pass for 30 days) or `SPOTIFY_TESTER_EMAILS` (a comma list of Spotify account emails checked in the OAuth callback before anything is stored). When both are set the key wins, so the allowlist is the quieter option for a short private list and the key is the option when the testers are not known in advance. With neither set, `/login` shows a short note that sign-in is for testers, offers Start, and `/api/auth/spotify` redirects to `/login?error=testers_only`. "Create in Spotify" is rendered only for a signed-in tester, is loaded with `next/dynamic` so visitors never download that code, and works in two steps: `POST /api/playlists/resolve` turns the MUSE list into Spotify URIs for the tester's own account by searching each song and accepting only title-and-artist matches, then the existing export route creates the playlist. Unresolved songs are reported by count, never guessed. A unit test (`src/lib/open-path.test.ts`) walks the real import graph from the chat route and the chat components and fails if any of them reaches the Spotify client, token store, Spotify service, export, or tester modules.

**Why**
The brief requires that no normal-user path can ever require a Spotify token and that this be tested explicitly, not promised. Hiding the button is not enough: the start route, the callback, and the export have to refuse on the server, and the open path has to be checked at the module level so a future import does not quietly reintroduce the dependency. A server-checked key was chosen over a client-side flag because anything in the bundle is public, and over a magic link because the key needs no email provider.

**Alternatives considered**

- Allowlist only: simple, but every tester must share their Spotify email before they can try the app.
- Key only: easy to hand out, but nothing stops the key from being forwarded; the allowlist exists for the stricter case.
- Removing Spotify sign-in entirely: it still backs the account pages until Task 7 and the tester export, and removing it is cheaper later than re-adding it.
- Resolving songs on the client with the Spotify Web API: would put a Spotify token in the browser, which the brief forbids.

**Impact**

- New env names in `.env.example`: `TESTER_KEY`, `SPOTIFY_TESTER_EMAILS`. Neither is needed for the public app; without them sign-in is off.
- New routes: `POST /api/tester` (rate limited to 5 per minute per IP) and `POST /api/playlists/resolve` (session required, 10 per minute per user).
- `/login` has three states: visible, key prompt, hidden. All three keep the no-account Start action.
- The import-graph test is a guard, not a runtime check; it covers the modules it lists, so new chat entry points should be added to its list.

---

## 2026-10-08: Songs open through public search links, and a list leaves MUSE as text, CSV, or a share sheet

**Decision**
Every song in a list has open-in links built from public search URLs (`src/lib/catalogue/search-links.ts`): Audiomack and Boomplay always visible, Spotify, Apple Music, YouTube Music, and Deezer behind a per-song "More" toggle. A verified pick links to its exact Deezer or Apple Music page for that service. The list has Copy list (clipboard), Download as text, Download as CSV, and Share: the Web Share API when the browser has it, otherwise a `wa.me` WhatsApp link carrying the same text. The text format is the list title, "Built with MUSE", numbered "Title by Artist" lines, and a "Make your own" link to `/chat` on the current origin. All of it runs in the browser with no key, no account, and no server call.

**Why**
The brief asks for links on the services people in Nigeria actually use, with Audiomack and Boomplay prominent, and for a way to take the list out of MUSE without Spotify. Search URLs are the only link type that works for every service without an API agreement, and they degrade gracefully: a search page is still useful when a catalogue lacks the exact song. Hiding four of six links per song keeps a twelve-song list to a screenful on a mid-range phone. The share text goes out as plain text rather than a link to a saved page because guest lists are not stored on the server.

**Alternatives considered**

- Deep links through each service's API: needs keys or partner agreements for most of them, and Audiomack and Boomplay have no public search API.
- A hosted share page per list: needs server storage of guest lists, which the counters-only decision rules out.
- Showing all six links per song: clearer, but too much to scroll on the target devices.

**Impact**
New: `src/components/chat/TrackLinks.tsx`, `src/components/chat/PlaylistActions.tsx`, `src/lib/playlist-text.ts`. `RecommendationList` renders both. URL patterns that are documented and stable: Spotify `open.spotify.com/search/{q}`, Apple Music `music.apple.com/ng/search?term={q}`, YouTube Music `music.youtube.com/search?q={q}`, Deezer `www.deezer.com/search/{q}`. Patterns written from memory that the owner must check on a phone, with the app installed and without it: Audiomack `audiomack.com/search?q={q}` and Boomplay `www.boomplay.com/search/default/{q}`; if either is wrong, only the two functions in `search-links.ts` change. The CSV carries a byte order mark so Excel reads accented names correctly. No new environment variables.

---

## 2026-10-08: Lists are checked against Deezer and iTunes without a login, unverified picks stay, and both chat paths share one engine

**Decision**
Every list MUSE builds is verified before it is shown (`src/lib/catalogue/`). Deezer's keyless search is asked first with its advanced `artist:"" track:""` syntax, then a plain query; Apple's iTunes Search API (country NG) is the fallback, capped at eight calls per run because Apple allows roughly twenty a minute. A pick is verified when the core title and an artist match a catalogue entry, with features, remix and remaster notes, accents, and punctuation ignored. A pick whose artist exists in a catalogue but whose title was not found stays in the list as unverified with a one line reason and search links (Audiomack, Boomplay, YouTube Music). A pick is dropped only when no track search and a final Deezer artist search find any artist match. Every call has a 2.5 second timeout under a 7 second run deadline; a failed or timed-out lookup leaves a pick unverified, never dropped; stable outcomes are cached in memory for ten minutes. The stream gains a "checking" stage and the done event carries each pick's verification, source link, and the dropped count. The list footer attributes Deezer and the Apple iTunes Search API and states MUSE is not affiliated with or endorsed by either; the CSP admits their artwork hosts. Signed-in discovery now runs through the same engine (model list, verification, scope, language) with the saved conversation's last ten turns as context; the answer is stored with its list in a new nullable `messages.list` jsonb column (apply with `npm run db:push`), and the conversation endpoint returns it so a reloaded chat shows the songs again. The Spotify search engine, its candidate pipeline, and the Spotify error branches are gone from the chat route; `extractChatIntent` and the two helpers Discover still uses remain in `recommendation-engine.ts`.

**Why**
The brief asks for verification without a login, that unmatched Nigerian tracks are not dropped, that only clear hallucinations with no artist match go, that lookups run in parallel with timeouts and a short cache, and for attribution. The owner decided after Task 2 that testers move onto the new engine once verification exists, so the two paths converge here rather than maintaining a Spotify-only engine next to a catalogue-checked one. The asymmetry in the drop rule is deliberate: Deezer and iTunes are thin on Fuji, Apala, older Highlife, and much Street-pop, so a missing title is weak evidence while a missing artist across searches is strong evidence. Keeping the list on the message, rather than in the old `recommendations` table keyed by Spotify id, is the only way a saved conversation can reload its songs.

**Alternatives considered**

- Spotify search with an app token for verification: needs Spotify credentials on every normal path, which the brief forbids.
- MusicBrainz as the fallback: strict rate limits (one request a second) and sparse Nigerian coverage; Apple's NG store is better here.
- Dropping every unverified pick: cleaner lists, but it would throw away exactly the Nigerian music the product exists for.
- A verification cache in Redis or Postgres: more hits across instances, but another dependency for a ten minute memory; revisit if Deezer quota errors appear in logs.
- Keeping the Spotify-search engine for signed-in testers: two engines, two payload shapes, and a Spotify dependency in the chat; rejected with the owner's decision.

**Impact**
New files: `src/lib/catalogue/{types,normalise,cache,deezer,itunes,verify,search-links,index}.ts` with tests, `src/app/api/chat/signed-in-chat.test.ts`. Changed: `open-chat.ts` (`composePlaylist`, checking stage, `dropped`), `route.ts` (signed-in discovery on `composePlaylist`, `recentTurns`, `saveListAnswer`), `[id]/route.ts` (returns lists), `schema.ts` (`messages.list`), `RecommendationList.tsx` (badges, links, attribution), `ChatMessage.tsx` (empty state after a check), `next.config.ts` (img-src), `recommendation-engine.ts` (trimmed). Operational: run `npm run db:push` before signed-in testers use this build; watch logs for "Catalogue lookup failed" with Deezer code 4 (quota). Audiomack and Boomplay search URL patterns are from memory and must be checked on a phone. The tester-only "Create in Spotify" export is not reachable from new chat lists until Task 6 reattaches it to the verified list; Discover and Profile for accounts still use Spotify data until Task 7. No new environment variables.

---

## 2026-10-08: MUSE speaks from Lagos by default, with scope and language the visitor controls on the device

**Decision**
The model prompts for chat and lists are assembled per request in `src/lib/ai/muse-prompt.ts` from a shared identity, a genre map that puts Nigerian music at the centre (Afrobeats, Afro-fusion, Amapiano, Alte, Street-pop, Highlife, Fuji, Juju, Apala, Naija hip-hop, Gospel, and the classics, each with real anchor artists), a glossary of Lagos moments, a Nigeria context (West Africa Time, Naira, Lagos as the default city), an honesty rule (only songs the model is confident exist; leave the rest out and say so; never claim anything was created), and two choices sent with every message: scope, `nigeria` by default (lead with Nigerian music, at least six of the songs, while honouring explicit requests for anything else) or `global` (no lean), and language, `english`, `pidgin`, or `mix`, with the instruction that Pidgin is written as a Lagos friend talks and never as a caricature, and that titles and artist names stay as released. The choices live in `localStorage` (`muse.chat.prefs.v1`) behind an external store, are shown as two compact segmented controls in the chat header, and are validated on the server (`ChatPreferencesSchema`), falling back to the defaults for anything unknown. The empty chat offers the nine vibes from the brief as chips; a chip sends its own label as the message because the prompt already understands what each one means. Stream status lines follow the language ("Dey cook your playlist...").

**Why**
The brief: Nigeria first by default, a Global toggle, an English / Pidgin / mix toggle, the nine vibes, Naira and WAT context, and no invented songs. The owner chose the chat header over a settings page so a guest never needs an account to set either choice, and chose on-device memory consistent with the counters-only rule for anonymous visitors. Sending the choices with each request, rather than storing them server-side, keeps the server stateless for guests and makes the same request work for accounts. Explaining the vibes in the prompt instead of expanding chips into hidden prompts keeps what the visitor sees equal to what was asked, which matters for trust and for the chat history they later read back.

**Alternatives considered**

- A settings page for guests: an account-shaped surface for people without accounts; rejected by the owner.
- Separate prompts per language, fully rewritten: three copies to keep in sync; one prompt with a language instruction is enough for the model and easy to tune.
- Chips that expand into long hidden prompts: better first answers in theory, but the visitor would see a message they did not write.
- Detecting Pidgin from the message: unreliable and surprising; an explicit control is one tap.

**Impact**
New files: `src/lib/chat-preferences.ts`, `src/lib/chat-preferences-store.ts`, `src/hooks/use-chat-preferences.ts`, `src/lib/ai/muse-prompt.ts`, `src/components/chat/ChatPreferenceControls.tsx`, `src/components/chat/VibeChips.tsx`. `ChatPostInputSchema` accepts `preferences`; `buildOpenPlaylist` takes `preferences`; `OPEN_CHAT_STAGES` is keyed by language; `useChat` returns `preferences` and `setPreferences`. The signed-in reply prompt now shares the same voice; its Spotify-search engine is replaced in Task 4. Client loading lines no longer mention a Spotify catalogue. Rotating English and Pidgin loading copy on the client, chip ripples, and vibration are Task 8. No new environment variables.

---

## 2026-10-08: Chat needs no account; guests get a model-built, region-tagged list and keep their chat on the device

**Decision**
`/chat` is open to everyone and every landing "Connect Spotify" action is now "Start", a plain link into it. Without a session, `POST /api/chat` answers from the turns the browser sends (at most ten, validated) and writes nothing to the database. Discovery requests go to a new open engine (`src/lib/ai/playlist-engine.ts`) that asks the model for a strict JSON playlist of eight to twelve real songs, each with a title, an artist, one sentence on why, and a region tag of Nigeria, Africa, or Global, parsed defensively (aliases, fences, duplicates, lists cut off by the token cap) and never padded; an answer with no usable song is retried once, then reported honestly. Other messages get a streamed reply whose prompt states that MUSE has no listening data for this visitor. On the client, a guest's conversation lives in `localStorage` behind a small external store read through `useSyncExternalStore`; the account-only pages (Discover, Library, Playlists, Profile, Settings) keep their sign-in redirect and disappear from a guest's navigation. The signed-in path, with its Spotify-backed engine and saved conversations, is unchanged for now.

**Why**
The owner's brief: the product must work for a visitor in Lagos with no Spotify account and no sign-up, and the server must return a strict, safely parsed list rather than prose. The owner also chose, at the start of this rebuild, that anonymous visitors leave only counters on the server, so the browser is the only honest place for their history. A separate engine, rather than a rewrite of the Spotify one, keeps the tester path working while verification (Task 4) and links (Task 5) are built on the new list; the two converge once the open list can be verified.

**Alternatives considered**

- Reuse the Spotify-candidate engine with an app token: Spotify search without a user still needs Spotify credentials and terms, and the brief is explicit that no normal path may depend on Spotify.
- Keep guest history on the server under an anonymous id: contradicts the counters-only decision and creates data to protect for people who never agreed to anything.
- One structured call for both chat and lists: cheaper, but it loses streamed replies and the clear status stages that make waiting on a slow connection bearable.
- A bottom tab bar with a single tab for guests: a bar that navigates nowhere; the chat gets the space back instead.

**Impact**
New files: `src/lib/ai/playlist-engine.ts`, `src/app/api/chat/open-chat.ts`, `src/lib/guest-chat-store.ts`, `src/components/chat/RecommendationList.tsx`, `src/components/landing/StartAction.tsx` (replacing `SpotifyPrimaryAction.tsx`). `ChatPostInputSchema` accepts `history`; the done event carries `recommendations`, `playlistTitle`, and `short`. The daily budget is now reserved for guests too, after validation, behind the rate limit and the human check. The list shows a note that its picks are not yet checked against a catalogue; that note is replaced by real verification in Task 4. Landing copy still describes the Spotify flow in places (How it works, What it does, the sample conversation); that is Task 10. No new environment variables.

---

## 2026-10-08: AI endpoints are protected by shared counters, hard caps, a daily budget, and an optional human check

**Decision**
Every AI route (`/api/chat`, `/api/discover`, `/api/me/profile`) now passes four gates before a model call. (1) Per-IP rate limits counted in Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, otherwise in the existing Postgres `rate_limits` table, through one `CounterStore` interface in `src/lib/security/counter-store.ts`; the limiter fails open and logs when neither store answers. (2) Input and output caps: chat messages are limited to 500 characters at the schema and in the input box, and every completion sends `max_completion_tokens` (default 1200, `AI_MAX_OUTPUT_TOKENS` can lower or raise it up to 4096). (3) A daily budget in the Africa/Lagos day (`AI_DAILY_BUDGET_REQUESTS`, default 1500, and `AI_DAILY_BUDGET_TOKENS`, default 2,000,000; 0 disables either) kept in the same counter store; when it is spent the routes answer 503 `AI_RESTING` with "MUSE is resting, try again soon." and the UI shows that instead of an error. Token usage is fed from the provider's `usage` field, including on streams. (4) Cloudflare Turnstile, active only when both `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY` exist: a solved challenge is exchanged at `POST /api/human` for a two hour HttpOnly cookie signed with HMAC-SHA256, the AI routes answer 403 `HUMAN_CHECK_REQUIRED` without it, and the chat screen mounts the widget on that code and retries the blocked message once verified.

**Why**
The product is about to open to visitors without a Spotify login (Task 2), so the only things standing between a script and the OpenAI bill are these gates. The owner chose Upstash with a Postgres fallback so a missing Redis never takes the limiter down, and chose to keep anonymous visitors as counters only, never rows of history. A pass cookie keeps Turnstile to one interaction per couple of hours instead of one per message, which matters on a mid-range phone on a metered connection. The budget replies with a calm sentence rather than a failure because running out of budget is expected behaviour, not a bug.

**Alternatives considered**

- Vercel WAF or edge rate limiting only: not visible in code, not testable locally, and tied to a plan.
- Counting rate limits in process memory: resets on every cold start and is per instance, which on Vercel means almost no limit at all.
- A spend-based budget in dollars: the API does not report cost; requests and tokens are the honest units we can count.
- Requiring Turnstile on every request without a pass cookie: the widget sometimes needs a tap, and tapping once per message is hostile.
- Hiding the limits behind a generic error: the UI now has a distinct state for each, with a retry only where a retry can work.

**Impact**
New env names for the Vercel dashboard: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AI_MAX_OUTPUT_TOKENS`, `AI_DAILY_BUDGET_REQUESTS`, `AI_DAILY_BUDGET_TOKENS`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, all optional. The CSP allows `challenges.cloudflare.com` for script, frame, and connect. `src/lib/security/turnstile-shared.ts` holds the values the browser widget needs so client bundles never import the database driver. Live Upstash, live Turnstile, and real OpenAI usage figures could not be exercised in the sandbox; the Postgres path, the signed pass, and every status code were exercised against a local server, and the remote services are covered by unit tests with fakes.

---

## 2026-10-08: Sign-in has its own page, a validated return path, and one error code per failure

**Decision**
`/login` is the single place a Spotify sign-in starts and the single place a failed one lands. It states what MUSE asks Spotify for (each line maps to scopes actually requested in `src/lib/spotify.ts`), links to the auth route as a real anchor, renders the honest disabled state when credentials are missing, and redirects visitors who already have a session. The shell sends signed out visitors to `/login?next=<path>` with `router.replace`; the auth start route stores a validated `next` in a third handshake cookie (`spotify_auth_next`, ten minutes, HttpOnly) and the callback returns there, or to `/chat`. `safeNextPath()` accepts only in-app paths (single leading slash, no scheme, host, backslash, or control characters, never `/login` or `/api/...`). The callback maps every outcome to one of `access_denied`, `session_expired`, `state_mismatch`, `auth_not_configured`, `user_not_registered`, `token_exchange_failed`, or `auth_failed`, clears all handshake cookies on every path, and answers every redirect with a relative `Location` and `Cache-Control: no-store`.

**Why**
The landing explained failures but gave the visitor nothing to do except scroll back to the button, and the shell dropped signed out visitors on the homepage with no memory of where they were going. Spotify's development mode refuses accounts the owner has not added (a 403 from `/v1/me`), which previously read as a generic token failure. Absolute redirects built from `request.url` pointed at the wrong host behind a proxy or a `0.0.0.0` bind.

**Alternatives considered**

- Keep sign-in on the landing page with a modal: the connection is the first real product moment and deserves a page that explains the permissions.
- Pass `next` through Spotify's `state` parameter: mixes an anti-forgery token with routing data and makes `state` long and user influenced; a cookie keeps it server side.
- Allow any same-origin URL in `next`: still an open redirect via `//host` and protocol-relative tricks; the allow list is simpler to reason about.

**Impact**
`AuthNotice` moves to `src/components/auth/` and is shared by the landing (older `/?error=` links keep working) and the login page. `src/lib/auth-flow.ts` owns cookie names, error codes, and the redirect helper, with unit tests. The Spotify redirect URI stays `/api/auth/spotify/callback`, so no dashboard change is needed; the spec's `/callback` path remains deferred. Logging out now reports failure (`LogoutResult`) instead of redirecting as if it succeeded; the sidebar shows the message, and the Settings panel (a PR #8 file) will pick that up after it lands.

---

## 2026-10-08: Phones navigate with bottom tabs; Now Playing is a rail above 1280px and a strip below

**Decision**
Replace the phone hamburger overlay with five bottom tabs (Chat, Discover, Library, Playlists, Profile) at 44px, keep Settings in the phone top bar, keep the 280px Now Playing rail from the xl breakpoint, and add a compact Now Playing strip for every width below it that renders only while a track is selected or playing. All shell bars are in normal flow inside a `100dvh` column; nothing is fixed over the content.

**Why**
The product owner chose both patterns on 2026-10-08. Tabs are reachable with one thumb and show where you are without opening anything. Between 1024px and 1279px the old shell had no playback surface at all. In-flow bars remove the padding arithmetic that fixed bars needed and let each bar own its safe-area inset.

**Alternatives considered**

- Keep the hamburger overlay, restyled: one extra tap for every navigation and no visible location.
- A full-width bottom player at every size instead of the rail: loses the artwork, the reason, and the longer notices on wide screens.
- Rail only, as before: playback hidden on common laptop widths.

**Impact**
`MobileNav.tsx` is removed in favour of `TopBar`, `BottomTabs`, and `NowPlayingStrip`; destinations come from one list in `shell-nav.ts`, so the sidebar and the tabs cannot drift. The sidebar entry is labelled "Chat" rather than "New chat" because a link to the current route starts nothing; the chat page keeps its own "New chat" control. Phase 5 and later screens should assume the scroll container is the page area, not the window.

---

## 2026-10-07: The landing decides "Connect Spotify" availability on the server

**Decision**
The landing page reads the Spotify sign-in configuration on the server for every request (`isSpotifyLoginConfigured()` in `src/lib/spotify-config.ts`, which needs `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`, and a usable `ENCRYPTION_KEY`) and passes the result to the header, hero, and closing band. When sign-in cannot complete, the primary action renders disabled with a visible explanation. The auth start route redirects browser navigations back to `/?error=auth_not_configured` and keeps the JSON 503 for programmatic callers, and the landing now explains every `?error=` code the auth routes redirect with.

**Why**
Before this, the button navigated to a raw JSON 503 page whenever credentials were missing, and failed sign-ins landed on the homepage with no message. The page is already `force-dynamic`, so a server-side read costs nothing, needs no extra request, and never flashes between states.

**Alternatives considered**

- Expose a `spotifyConfigured` flag on `/api/me` and decide in the browser: works for the app shell later, but the landing would render an optimistic button during the fetch.
- A dedicated status endpoint: an extra request for one boolean.
- Hide the button when unconfigured: the specification requires a visibly disabled control with an explanation.

**Impact**
`src/app/page.tsx` is now an async server component that renders the sync `LandingPage` body; tests render `LandingPage` directly and call `HomePage` for the wiring. The helper is the single definition of "configured" for the start and callback routes and for any later settings screen. In this sandbox, with no credentials, the preview shows the disabled state.

---

## 2026-10-07: Sample conversation uses real songs, no durations, no Spotify ids

**Decision**
The landing sample shows three real songs by Nigerian artists chosen with the product owner (Free Mind by Tems, Essence by Wizkid and Tems, Calm Down by Rema) with one-line reasons, but keeps non-Spotify `sample-*` ids and omits durations.

**Why**
The previous rows were invented artists, which the trust rules forbid. Spotify is unreachable from the build environment, so durations and ids cannot be verified; showing unverified numbers or links would be invented data. The real `TrackRow` renders cleanly without a duration and without a link.

**Alternatives considered**

- Keep invented placeholders: rejected by the specification (A2).
- Type durations from memory: rejected, unverifiable.
- Fetch real ids and durations from Spotify: impossible offline; can be added later from a verified lookup if links are wanted.

**Impact**
`SampleTrack.durationMs` is optional. The "How it works" reason line is derived from the first sample track so the two never drift, and its last thinking line no longer states an invented result count.

---

## 2026-10-07: Legal pages are drafts derived from the code, with marked placeholders

**Decision**
Replace the bracketed prompt placeholders with full drafts of the Privacy Policy, Terms of Service, and Spotify Attribution written from the code paths that handle scopes, storage, cookies, AI requests, and data controls. Each page is labelled "Draft for review", carries a notice that it is not in force, marks unknown values (operator name, contact email, hosting provider, governing law) as visible placeholders, and ends with a list of what a reviewer must confirm.

**Why**
Honest drafts the owner can review beat empty prompts, and tying each statement to a code path keeps them accurate. The owner chose placeholders over typing the operator details during this phase.

**Alternatives considered**

- Keep prompts until a lawyer writes the text: leaves the footer pointing at pages with no information.
- Publish without the draft label: would present unreviewed text as binding.

**Impact**
Tests check that every Spotify scope in `src/lib/spotify.ts` and the session cookie facts in `src/lib/session.ts` appear on the privacy page, so a scope or cookie change fails the build until the page is updated.

---

## 2026-10-07: Keep Fredoka Variable and Bagel Fat One as the typefaces

**Decision**
Keep the existing interface typeface (Fredoka Variable) and display typeface (Bagel Fat One) rather than moving to one of the typefaces listed in the master specification.

**Why**
The product owner chose to keep them when asked on 2026-10-07, with the trade-offs stated: neither is on the specification's preferred list, and neither ships tabular figures, so durations rely on the `tabular-nums` width utility rather than the font.

**Alternatives considered**

- Instrument Sans with Instrument Serif: the recommended editorial pairing, installable from the npm registry.
- Geist, or Manrope, for the interface; Fraunces for display.
- Satoshi or General Sans: not installable from this environment (Fontshare is not reachable).

**Impact**
The type scale is built around weight and size rather than a serif contrast. The width hack for numerals stays. The decision can be revisited in a later design pass; the hero wordmark is SVG and does not depend on either font.

---

## 2026-10-07: A development-only design system reference route

**Decision**
Add `/design-system`, rendered from the real primitives and tokens, served in development only (`notFound()` in production builds).

**Why**
Each phase requires checking the interface in a browser at desktop and mobile widths and with reduced motion. A page that renders every token, type level, button state, field state, focus style, and motion rule from the same components the product uses makes that check repeatable and keeps the design system honest. Contrast ratios on the page are computed from the tokens rather than typed in.

**Alternatives considered**

- Storybook or a similar tool: heavier dependency footprint and a second build pipeline for a single-package app.
- No reference page: verification would rely on reading CSS and visiting product screens that do not yet exercise every state.

**Impact**
One extra route in development. The page is excluded from indexing and returns 404 in production, verified with `next start`.

---

## 2026-10-07: Two low-contrast tones, one danger tone, tighter radii, split focus rules

**Decision**

- Keep `--color-text-muted` at `#85858C` (5.4:1 on the background) as the darkest tone for small text, and add the specification's `#6B6B73` as `--color-text-faint` (3.7:1) for large text, disabled text, and decorative details only.
- Add `--color-danger` (`#E8705F`, 6.5:1) for error text and invalid field edges, replacing ad hoc Tailwind reds over time.
- Set `--radius-md` to 6px and `--radius-lg` to 8px (previously 8px and 12px) so controls stay within the 2px to 6px range.
- Replace the single `!important` focus outline with two rules: a 2px offset accent ring for links and buttons, and an accent edge for fields. The old rule forced a floating ring onto every field, including the chat composer, which already had its own softer treatment, so fields showed two indicators.
- Make the Tailwind theme `static` so unused tokens still reach the browser as CSS variables.

**Why**
The specification lists `#6B6B73` as the muted tone, but at that value small text fails WCAG AA, and the existing screens use the muted tone at 12px to 14px in 84 places. Keeping the AA-safe tone for small text and introducing the specification's value for large and decorative use satisfies both the palette and the accessibility requirement without a sweep across screens that belong to later phases. The screens already used Tailwind reds for errors in more than ten places, so a token is a consolidation, not an addition.

**Alternatives considered**

- Set muted to `#6B6B73` and move small-text usages to `secondary`: large churn across files that the open pull request #8 also edits, and a visibly brighter interface.
- Keep radii at 8px and 12px: outside the specification's stated range for controls.
- Keep the `!important` outline: guaranteed a ring everywhere, but produced double indicators on fields and prevented any refinement.

**Impact**
Palette and radius changes apply through the tokens with no per-screen edits. Components that disable the outline must supply their own ring; an audit found every current `outline-none` sits on a field that also sets an accent border, so nothing lost its indicator. Contrast guarantees are now unit tested.

---

## 2026-10-07: Prettier is configured but not yet applied repository-wide

**Decision**
Add `.prettierrc` (single quotes, semicolons, trailing commas, 80 columns) and `.prettierignore`, plus a `format:check` script, without running `prettier --write` across the codebase in this phase.

**Why**
The configuration matches the dominant existing style (single-quote imports outnumber double-quote imports roughly ten to one), but 101 of 150 files under `src/` still differ from Prettier output. Reformatting them now would touch most of the files changed by the open pull request #8 and create avoidable merge conflicts.

**Alternatives considered**

- Apply formatting immediately: cleanest end state, but it would conflict with PR #8 and mix a mechanical change into a foundation phase.
- Leave Prettier unconfigured: the `format` script already existed, so leaving it without a config would keep producing inconsistent results.

**Impact**
`npm run format:check` reports differences but is not part of `npm run verify` yet. A dedicated formatting-only commit should follow once PR #8 is merged or closed, after which `format:check` can join `verify`.

---

## 2026-10-07: `dev:stack` applies the schema automatically only to loopback databases

**Decision**
`scripts/dev.mjs` runs `drizzle-kit push` without asking only when `DATABASE_URL` points at `127.0.0.1`, `localhost`, or `::1`. For any other host it skips the push and tells the developer to run `npm run db:push` deliberately.

**Why**
A one-command startup is only safe if it cannot modify a shared or production database by accident. The hostname is a simple, reliable signal that the target is a throwaway local database.

**Alternatives considered**

- Always push: convenient, but a developer with a hosted `DATABASE_URL` in `.env.local` would mutate that database on every start.
- Never push automatically: safe, but it makes the "one command" startup a two-command startup for everyone.

**Impact**
Local Docker and locally installed PostgreSQL work with a single command. Hosted databases keep the existing explicit `drizzle-kit push` step. The script never uses `--force`, so destructive schema changes still prompt.

---

## 2026-10-07: Keep npm as the package manager for now

**Decision**
Keep npm and the committed `package-lock.json` instead of switching to pnpm.

**Why**
The master specification asks for pnpm workspaces, but the project is a single package, and the open pull request #8 modifies `package-lock.json`. Switching lockfiles now would guarantee a conflict with that work for no functional gain. pnpm is obtainable through corepack if the decision is revisited.

**Alternatives considered**

- Switch to pnpm immediately: aligns with the specification, conflicts with PR #8.
- Adopt pnpm workspaces: only meaningful if the repository is split into multiple packages, which the stack decision below rules out for now.

**Impact**
All documentation and scripts use `npm`. Revisit after PR #8 is resolved if a workspace split ever becomes necessary.

---

## 2026-10-07: Keep Drizzle ORM instead of migrating to Prisma

**Decision**
Keep the existing Drizzle ORM schema and queries. The database connection check required by Phase 1 already exists: `GET /api/health` runs `select 1` through Drizzle and returns `{"ok":true}` or a 500 `{"ok":false}` without leaking details.

**Why**
The schema in `src/db/schema.ts` already matches the models in the specification (users, Spotify accounts, music profiles, conversations, messages, playlists, playlist tracks, recommendations, preferences) plus sessions, memories, and rate limits. Replacing the ORM would rewrite every API route and database test for parity with a tool name, not for a product outcome.

**Alternatives considered**

- Migrate to Prisma: matches the specification text, high churn, no functional gain.
- Run both: two ORMs against one schema is a maintenance liability.

**Impact**
Schema changes continue to go through `drizzle-kit push` locally and through the deployment change process elsewhere. The specification's Prisma references map to Drizzle in this repository.

---

## 2026-10-07: Keep the Next.js App Router application instead of rebuilding as a Vite + Express monorepo

**Decision**
Continue building MUSE on the existing Next.js 16 App Router application (React 19, TypeScript strict, Tailwind CSS 4, Motion, TanStack Query, Zod, Drizzle ORM, PostgreSQL). Phase 1 becomes a foundation audit and gap-fill rather than a project initialization.

**Why**
The repository already contains about 24,500 lines of MUSE work across seven merged pull requests: the landing page with its signature animation system, the app shell, Spotify OAuth, the Spotify service, the AI pipeline, chat, playlists, library, discover, profile, memory, settings, security middleware, and 277 passing tests. The master specification requires improving existing MUSE work rather than rebuilding it, treats the existing animation system as mandatory, and requires stopping to ask before expensive architectural changes. The decision was confirmed with the product owner on 2026-10-07.

**Alternatives considered**

- Rebuild as the specified Vite client + Express server + shared package monorepo with Prisma: a ground-up rewrite of every route, the SSR-driven hero entrance, session handling, and the test suite, with high regression risk and no user-facing gain.
- Keep Next.js but split into pnpm workspaces: adds packaging overhead to a single deployable with no present need for shared packages.

**Impact**

- Frontend and API routes deploy together as one Next.js application. The specification's "independently deployable frontend and backend" requirement is not met in the literal sense; the API routes remain a clean server-side boundary (`src/app/api/*`, `src/lib/*`) if a split is ever needed.
- Specification references to Express routes, React Router, and Prisma map to Next.js route handlers, the App Router, and Drizzle respectively.
- Verification in the Phase 1 sandbox was limited to TypeScript, ESLint, Vitest, the production build, HTTP checks against the running dev server, and a real PostgreSQL 16 instance. No browser automation was available there, and Docker was not available either; the Compose file follows the documented `postgres:16-alpine` image and must be exercised on a machine with Docker.
