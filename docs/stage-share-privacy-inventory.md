# Privacy statement inventory

Extracted from the rendered Privacy page on 13 October 2026. Every paragraph and list item in the numbered sections is reproduced below, including legal assertions, provider-policy statements and operator commitments that source inspection cannot verify. This is an owner review inventory, not legal approval.

Neon is the owner-supplied database provider. The pre-existing README and docs contained no Neon connection-host pattern, so the provider could not be independently verified without accessing secrets. No connection secret was read. Vercel is identified from the owner-supplied deployment context. Regions remain unconfirmed and are not invented.

## 1. Who is responsible

* MUSE, operated by Baptist Arowomutin, is the data controller for the personal data described on this page. For questions or requests about your data, write to barowomutin@gmail.com.

## 2. Using MUSE without an account

* The chat works for everyone with no sign-in. In that mode MUSE keeps these things in your browser's local storage, on your device. Relevant conversation and taste data is sent with requests as described below:

* The last 40 messages of your conversation (key muse.chat.local.v1).

* Your chat settings: the Nigeria or Global scope and the English, Pidgin, or mix language choice (key muse.chat.prefs.v1).

* Your display settings: dark or light and Lite mode (key muse.ui.prefs.v1).

* Your taste snapshot, if you add one on the tester-only Profile page (key muse.taste.v1). See the optional features below.

* The server keeps no account, no conversation, and no profile for a visitor without an account. Counters and operational logs are described under "What the server stores".

## 3. What is sent to the AI provider

* MUSE uses the OpenAI API (the gpt-4o-mini model by default) to read your request, choose songs, and write the one-line reasons and the words about your taste. Depending on the feature, a request contains:

* Chat: your message (up to 500 characters), up to ten earlier messages in the same conversation, your scope and language choice, and, when you have added a taste snapshot, the names of up to ten artists, ten top songs, and ten recent tracks from it with the name of its source (Last.fm or a Spotify export).

* Your taste in words: the same ten artists, ten top songs, and ten recent tracks from the snapshot, with any date range and play count the source provided.

* For testers who sign in with Spotify: Discover requests include up to ten top artists and ten top tracks from Spotify. Profile insights also include up to ten recently played tracks and artist genres. Signed-in Chat, Discover, and Profile can include up to twelve explicit Memory notes from Settings. Chat uses the supplied taste snapshot rather than fetching Spotify listening history.

* MUSE does not add your email address, IP address, Last.fm username, Spotify user ID, or tokens to AI prompts as identity fields. Anything you include in messages or Memory notes may be sent as content. OpenAI processes API requests under its own API terms and data usage policy (linked below); under those terms API data is not used to train its models. MUSE caps the model's output and the shared daily budget. Output defaults to 1,200 tokens with a configurable maximum of 4,096. Daily budgets default to 1,500 request reservations and 2,000,000 reported tokens, resetting at midnight in Lagos. A zero budget setting disables that cap. Tokens are counted after completion, so this is not a hard spending ceiling. Rate and budget guards allow requests if their counter stores are unavailable. When an available guard finds the budget exhausted, MUSE says it is resting.

* The model proposes songs; it does not confirm them. For public playlist requests, MUSE checks the proposed tracks against public music catalogues (next section) and labels what it could not confirm as unverified. AI output can still be wrong, which the Terms of Service explain.

## 4. Music catalogues and open-in links

* To check that a song is real, the MUSE server sends its title and artist name to the Deezer API and, when Deezer finds nothing, to the Apple iTunes Search API. These requests carry song names only; they do not include your message, your IP address, or anything about you. Results are cached briefly on the server by song name.

* Cover art is loaded by your browser directly from Deezer's or Apple's image servers, which therefore see your IP address and browser details in the same way as any image on the web. Artwork is shown when a catalogue supplies an image, including in Lite mode.

* "Open in" links take you to a matching catalogue page when available, or a search for the song on Audiomack, Boomplay, Spotify, Apple Music, YouTube Music, or Deezer. Link navigation happens when you tap; catalogue and artwork requests happen as described above; after that their own privacy policies apply. The Share action uses your device's share sheet or opens WhatsApp with the list as text; MUSE does not see where you send it.

## 5. Optional features: Last.fm and a Spotify data export

* Last.fm: if you type a Last.fm username on the Profile page, the MUSE server asks the Last.fm API for that account's public top artists and recent tracks, and returns a snapshot to your browser. The server does not store the username or the result. The snapshot label (for example "Last.fm: ada") stays in your browser. Only public Last.fm data is read; MUSE cannot read a private profile.

* Spotify data export: the file you get from Spotify's "Download your data" is read inside your browser. The raw file is never uploaded and the server never receives it. Your browser keeps only the summary: up to 20 artist names, 20 top songs, and 20 recent tracks, the date range, and the play count.

* Both are things you choose to add. "Remove from this device" on the Profile page deletes the snapshot at once. When you ask for "Your taste in words", the ten artists, ten top songs, and ten recent tracks described above go to the AI provider.

## 6. What the server stores

* For every visitor:

* Rate-limit counters use a one-way hash of the proxy-reported IP address for guests, or a user ID for signed-in requests. The hash uses ENCRYPTION_KEY as a pepper when configured. Missing IPs share an anonymous bucket. Counters live in Upstash Redis or Postgres; limits and windows vary by route.

* A shared daily usage total for the whole service, with no per-visitor detail.

* Operational logs include errors and warnings. Some routes log error objects without a central redaction layer, so the code cannot guarantee that logs exclude personal data or secrets. Hosting access logs and retention depend on deployment settings.

* For testers who sign in with Spotify, the server also stores an account record, conversations, recommendations, playlists created through MUSE, a taste profile, preferences, and Memory notes, as described under "Testers who sign in with Spotify".

## 7. Cookies

* A visitor without an account normally has no MUSE cookie at all. These are the only cookies MUSE can set:

* muse_human: set for two hours after you pass a Cloudflare Turnstile check, and only when the operator has turned the check on. It holds a signed timestamp, not an identifier. Cloudflare processes your IP address and browser details to run the check under its own privacy policy.

* muse_tester: set for 30 days after a tester enters the tester key. It holds a signed pass, not an identifier.

* muse_session: keeps a signed-in tester signed in. It is HttpOnly, SameSite=Lax, Secure in production, and expires 30 days after sign-in.

* spotify_auth_state, spotify_auth_next, and spotify_code_verifier: protect the sign-in handshake and retain a validated return path for testers, and expire after ten minutes.

* MUSE has no analytics or advertising integration. When enabled, Cloudflare Turnstile loads a third-party verification script. MUSE-controlled cookies are HttpOnly, SameSite=Lax, and Secure in production.

## 8. Testers who sign in with Spotify

* Spotify sign-in is not offered to the public. It is available only to testers the operator has allow-listed or who hold the tester key, so that the "Create in Spotify" feature can be tested. If you are not a tester, nothing in this section applies to you and MUSE receives nothing from Spotify about you.

* A tester connects through Spotify's own sign-in page; MUSE never sees the Spotify password. Spotify asks the tester to grant these permissions:

* Profile (user-read-private, user-read-email): Spotify user ID, display name, email address, and profile image. MUSE stores these four fields.

* Listening (user-top-read, user-read-recently-played, user-library-read): top artists, top tracks, recently played tracks, and saved tracks and albums, read from Spotify when a request needs them and not kept as a separate copy.

* Playlists (playlist-modify-private, playlist-modify-public): to create playlists in the tester's account. Playlists MUSE creates are private unless changed in Spotify.

* Playback (user-read-playback-state, user-modify-playback-state): to see available devices and what is playing, and to start, pause, or skip on a chosen device. Spotify requires Premium for this.

* Spotify gives MUSE an access token and a refresh token. MUSE stores both encrypted (AES-256-GCM) with their scope and expiry, and uses them for nothing else. For a signed-in tester the server stores conversations, the recommendations shown, playlists created through MUSE (name, Spotify playlist ID, track list), a short taste profile, preferences, and Memory notes written in Settings. Nothing a tester does is ever required of an ordinary visitor: no feature for the public depends on a Spotify account or token.

## 9. How long data is kept

* Browser storage stays on your device until you clear it, start a new chat, or remove the taste snapshot.

* Counter windows stop counting old usage after their reset time. Redis keys expire, but Postgres rows are not automatically deleted; an expired row is reused when its key is next requested. The shared AI budget uses a Lagos calendar day.

* The Turnstile pass lasts two hours; the tester pass and a tester session last 30 days; the Spotify handshake cookies last ten minutes.

* Catalogue lookups are cached on the server by song name for a short time and contain no personal data.

* Tester account data is kept until the tester deletes it. Disconnecting Spotify deletes tokens, conversations, recommendations, taste profile, and playlist records right away; the account, preferences, and Memory notes stay until the account is deleted.

## 10. Deleting your data

* Without an account:

* "New chat" in the chat header deletes the stored conversation from your browser.

* "Remove from this device" on the Profile page deletes the taste snapshot.

* Clearing this site's data in your browser settings removes everything else, including your display and chat settings.

* Guests have no saved server conversation to delete. Hashed counter keys and operational logs may remain as described above.

* Testers signed in with Spotify can, in Settings:

* Export their data as a JSON file. Tokens are never included.

* Disconnect Spotify, which deletes the data listed under retention.

* Delete the account and its related database records. This does not remove independent counter rows, hosting logs, or browser storage.

* Add, edit, delete, or clear Memory notes.

* A tester can also withdraw MUSE's access from the Spotify account page under Apps. Deleting data in MUSE does not delete playlists already created in a Spotify account. For anything these controls do not cover, write to barowomutin@gmail.com to request help with your data.

## 11. Who else receives data

* OpenAI (United States), which processes the AI requests described above.

* Deezer and Apple, whose catalogue APIs receive song names from the server and whose image servers deliver cover art to your browser.

* Last.fm, which receives the username you type, only when you use that feature.

* Cloudflare, which runs the Turnstile check when the operator has turned it on.

* Vercel, which hosts MUSE, and Neon, which hosts the MUSE database. The rate-limit store is Upstash Redis when it is configured.

* Open-in destinations and WhatsApp receive navigation or shared-list data when used. Catalogue and image providers also receive the requests described above.

* Spotify AB, for testers who sign in, under its own privacy policy.

* MUSE does not sell personal data, does not show advertising, and shares data with no one else unless the law requires it. Payments are not open; when a paid plan opens, Paystack will process payments and this page will change first.

## 12. Where data is processed

* MUSE is operated from Nigeria. Hosting and database processing locations still need to be confirmed; third-party providers may process data outside Nigeria. Where the Nigeria Data Protection Act 2023 applies, MUSE relies on your consent to the optional features, on the necessity of the processing to provide the service you asked for, and on its legitimate interest in keeping the service secure for the counters. The transfers rest on the processors' contractual data protection commitments.

## 13. Security

* API keys live only on the server, rate-limit keys store hashes rather than raw visitor IP addresses, Spotify tokens are encrypted at rest, cookies cannot be read by scripts, requests are rate limited, and every request that touches tester data checks the session first. No system is perfectly secure; if you believe your data has been exposed, write to barowomutin@gmail.com.

## 14. Children

* MUSE is not directed at children. Under the Nigeria Data Protection Act 2023 a child is anyone under 18; if you are under 18, use the optional features that involve personal data (the Last.fm import, the data export upload, and tester sign-in) only with a parent or guardian's consent. Tester sign-in also requires the minimum age Spotify sets in your country.

## 15. Your rights

* Under the Nigeria Data Protection Act 2023, and similar laws where you live, you can ask to access, correct, delete, or receive a copy of your personal data, withdraw consent, object to processing, and complain to the Nigeria Data Protection Commission or your own data protection authority. For a visitor without an account, conversation and taste storage is in the browser, but counters and operational logs may exist. For requests beyond the browser controls, write to barowomutin@gmail.com.

## 16. Changes to this page

* When MUSE starts collecting something new or sending data somewhere new, this page and the date at the top change first. Check the Terms of Service and the Spotify attribution page as well.
