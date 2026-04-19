# AudioShelf — Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Storage | Cloudflare R2 | Zero egress fees vs Supabase Storage's $0.09/GB egress. For a personal library with large audio files, egress cost matters. |
| Audio engine | HTML5 Audio + Web Audio API | Howler.js doesn't support Media Session API (lock screen controls) natively. Raw HTML5 Audio + MediaSession gives full control. |
| Skip length | 30 seconds | Audiobook convention. Spotify uses 15s for music. 30s matches Audible and listener muscle memory. |
| State management | Zustand | Lighter than Redux, no boilerplate, works well with React's concurrent mode, and the player state is a single flat store that doesn't need Redux's action/reducer pattern. |
| Data fetching | Direct Supabase client calls | TanStack Query was planned but for Slice 1 simplicity, direct client calls in useEffect are sufficient. Will add TQ in Slice 3 when caching/refetching logic gets complex. |
| Volume above 100% | GainNode (Web Audio API) | `HTMLAudioElement.volume` is capped at 1.0. GainNode supports arbitrary gain values. Required for volume boost feature. |
| Font | Inter (system-like) | Fraunces (the planned serif for book titles) is a Google Font that won't load offline. Inter is a high-quality sans-serif that degrades gracefully. Fraunces will be added to detail pages only in Slice 3. |
| Upload method | Presigned PUT to R2 | Server doesn't need to touch the file bytes. Client uploads directly to R2 with XHR for progress events. Server only generates the presigned URL and processes metadata after upload completes. |
| Metadata parsing | Server-side via music-metadata | music-metadata is a Node.js library. Parsing happens in the `/api/books` POST route after upload, using a range request to fetch only the first 10MB (where moov/ID3 tags live). |
| Signed URL lifetime | 24 hours for audio, 1 year for covers | Audio URLs rotate to prevent sharing. Cover images are static and can be long-lived. |
| Progress save | Every 5 seconds + on pause/end | 5s is frequent enough that you never lose more than 5s of position. Saving on every timeupdate event (every ~250ms) would hammer the database. |
| Resume threshold | 10 minutes | Audible's standard. Under 10 minutes = silent auto-resume. Over 10 minutes = prompt. Matches listener expectations. |
| Sleep timer fade | 10 seconds, GainNode | An abrupt cutoff wakes sleeping users. 10s fade is enough to be imperceptible while falling asleep but short enough not to miss significant content. |
| Auth | Supabase Auth | Built-in, handles email confirmation, session management, RLS integration. No custom auth code. |
| Database | Supabase Postgres | RLS policies mean we never accidentally serve one user's data to another. Each table has `user_id` and RLS enforces it at the database level. |
| CORS | Wildcard `*` for R2 | During development. For production, lock down to your actual domain in the CORS policy. |
| UUID generation | `gen_random_uuid()` | Supabase Postgres 15+ includes pgcrypto by default. `uuid-ossp`'s `uuid_generate_v4()` requires explicit extension activation and isn't needed. |
| Multi-user | Yes, from day 1 | All tables include `user_id` and RLS. Adding users later to a single-user schema is painful. Starting multi-user costs nothing. |
