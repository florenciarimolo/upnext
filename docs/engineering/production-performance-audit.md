# Production Performance Audit

Measured on 19 November 2026 against https://getupnext.io.

This document records what was observed and the improvement plan. It does not change product rules in `docs/core/application-logic.md`. Discover stays editorial and stable. Personalized HTML is not a candidate for a shared cache.

## How it was measured

Two views, on purpose:

- **Cold document, no browser cache.** `curl` from this machine. Response header `x-vercel-cache: MISS`. Origin region `iad1`.
- **Browser, desktop, one logged-in session.** JavaScript was warm after the first home load. Browser TTFB of about 30 ms is connection reuse or a prefetched document. It is not the cold-server number. Use the `curl` times for server cost.

Public HTML is `cache-control: public, max-age=0, must-revalidate`. Hashed files under `/_nuxt/` are `public, max-age=31536000, immutable`. Files in `public/` (fonts, logos, mockups) use `max-age=0`.

## What the numbers say

| Surface | Measurement | Reading |
| --- | --- | --- |
| Home, anonymous, first visit | 94 requests, 1.09 MB transferred. FCP 716 ms. HTML about 5 KB | About half the weight is fonts. Four Inter files, about 111 KB each |
| Home, signed in | `/api/recommendations` 2.6 s, starts at 1.2 s. Then 20 calls to `/api/titles/fetch-tagline` | Useful content appears around 3.8 s |
| `/{lang}/discover` | Server HTML says "Loading lists…" and has no `h1` | Editorial lists arrive in the client (`/api/discover/lists`, about 900 ms cold) |
| `/{lang}/discover/list/{slug}` | Server HTML title is the generic "Discover \| UpNext", no `h1`. Signed in: 17 `user_title_status` calls for 16 cards | The real title is written after hydration |
| Movie `687163` | Server 611 ms. Videos: 1 call | Provider logos requested at `w300` and painted at 48 px. Detail block duplicated (2 `h1`) |
| TV `37854` (One Piece) and `95557` | Server 3.9 s and 5.7 s. Season 1 of One Piece: 3.9 s | In the browser, One Piece first paint was 19.3 s. Repeat that cold: the same navigation reported a 32 ms document TTFB, so the 19.3 s includes client work on a document that was not a cold miss |
| Watchlist | One `/api/users/watchlist` (571 ms) | The collection itself is a single call. Every signed-in page also loads the full liked-title row |
| `public/` assets | Fonts, logos, mockups revalidate every visit | `/_nuxt/*` is already immutable for a year |

`/api/users/preferences` ran once on the signed-in home. `/api/titles/spanish-title` did not repeat. Those two fixes in `docs/engineering/network-performance.md` hold. Video language fallback and post-action `title-status` consolidation are still open there.

Database check for the two slow series, same day:

- `37854`: 24 seasons, none missing `air_date`, `episode_count`, `overview`, English name, or English poster.
- `95557`: 6 seasons, one row missing `air_date` and English poster.

The 4–6 s TV document time is therefore not "the HTML is large". Gzipped HTML was 10–24 KB. The handler was doing per-season database work on every response. See implementation status below.

## Test plan

Run each pass in a private window, once with an empty cache and once warm. Desktop 1440 px and mobile 390 px. Public pages: `en` and `es`. Where the HTML changes with auth, run signed out and signed in.

Record on every page: TTFB, FCP, LCP, CLS, INP, transferred bytes, request count, repeated `/api` URLs, and natural image width versus painted width.

Gate for this audit, not a new product target: public TTFB under 800 ms, LCP under 2.5 s, CLS under 0.1, and no per-card status or tagline request.

1. **`/{lang}/` signed out.** First visit and reload. LCP should be the headline or the mockup, not a Discover poster. Count Inter and Satoshi bytes. `/api/discover/lists` must not sit on the LCP. Only the visible logo theme should download. Check CLS when the cookie banner closes.
2. **`/{lang}/` signed in.** Time until the skeleton leaves. Duration of `/api/recommendations`. Counts for `fetch-tagline`, `preferences`, `genres`, and `watch-providers`. Change mood and attention: the second pass must not refetch genres or preferences. INP on filters and on marking a title.
3. **`/{lang}/discover`.** HTML without JavaScript includes the page title and list names. Time `/api/discover/lists`. Count TMDB images and the requested width (`w500` against about 48 px painted).
4. **`/{lang}/discover/list/{slug}`.** Use `under-100-minutes` and one long list. Title and `h1` are in the server HTML. Signed in: one status read for the page. Signed out: zero `user_title_status` calls. CLS when switching mosaic and list.
5. **`/{lang}/movie/{id}`.** One short title and one with many providers. Cold TTFB. Backdrop LCP. `/videos` at most 1 (the network doc still allows up to 3 for language fallback). Logos at `w300` or `w500` painted small. One `h1` in the DOM. Like or status change: how many times `title-status` is requested again.
6. **`/{lang}/tv-show/{id}`.** One short series and one long series (`37854`). Cold TTFB with `x-vercel-cache: MISS`. HTML weight. Cold FCP, to confirm or drop the 19 s reading. Whether the banner and the season list exist twice (mobile and desktop). Episode, following, and video calls.
7. **`/{lang}/tv-show/{id}/season/{n}`.** Season 1 of a long series and one short season. TTFB, weight, below-the-fold episode images with `loading="lazy"`, one episode-status read.
8. **`/{lang}/watchlist`, `/following`, `/lists`.** Time to the first card. One collection request, not one per item. Sorting or changing tab does not reload the full likes query. Empty list, on another account if needed.
9. **`/{lang}/preferences` and `/my-account`.** Save region or language and count how many later pages reuse preferences. Target: no repeated preferences fetch in the same session. No theme flash.
10. **`/{lang}/how-it-works`, `/faq`, `/privacy`.** TTFB, LCP, one `h1`, and no recommendations or Discover calls. FAQ: CLS when an accordion opens.
11. **Header search.** Type 3 characters. Debounce, requests per keystroke, time to results. Repeat the same query and check cache.
12. **Sign-in modal on the home page.** Submit until the signed-in home. The home must not download JavaScript that is already cached. After sign-in, mood and attention leave the disabled state without an extra round trip.
13. **Cache and crawl, once per deploy.** Headers for `/fonts/*`, `/mockups/*`, `/logo-*.png`, and one movie page. `sitemap.xml` and one language sitemap: time, and that movie, series, season, and list URLs are present. Request the same public title twice and record whether the second response is still `MISS`.

## Improvement plan

Ordered by time removed. Items 1 and 4 match the rule that Discover and title pages stay stable and indexable. Item 8 (shared HTML cache) is not written as a required pattern in the docs. Confirm it before applying it.

1. **Cut server time on series and season documents.** A series page took 4–6 s on a cache miss while the compressed HTML was 10–24 KB. The cost is generating the page. **In progress.** See the status section. The season document (`/tv/{id}/season/{n}` plus overview fallback) is still a separate request and was 3.9 s for One Piece season 1. That path was not changed in this pass.
2. **Stop duplicating the detail DOM.** Movie and series pages rendered two banners and two `h1` elements, one of them hidden, and two provider lists. **In progress** in `MediaBannerDetail.vue` and `SeasonBannerDetail.vue`: one provider list, placed with the grid under the poster on desktop and after the details on mobile; one `h1` (the desktop title is a paragraph that exposes the same heading to assistive tech); each image uses `<picture>` so the hidden breakpoint does not download the other asset. The two layouts stay as they are.
3. **Batch `fetch-tagline`.** The signed-in home fires 20 POSTs to the same endpoint, about 400 ms each, after waiting 2.6 s for recommendations. One request for the ids in the batch, or include the tagline in `/api/recommendations`.
4. **Render Discover on the server.** The Discover index arrives as "Loading lists…" with no `h1`. A list arrives with a generic title and an empty `h1`; the real title is set on the client. For a stable editorial page, the list name, the `h1`, and the cards belong in the HTML. Signed in, replace the 17 `user_title_status` reads with one read. Do not add recommendation ranking to these pages.
5. **Request images at the painted size.** Discover and home posters ask for `w500` and display at about 48 px. Provider logos ask for `w300` for 48 px, and some are requested 2 or 4 times. Use `w92` or `w154` on cards and `w45` on logos. Set width and height. Home CLS was 0 on the anonymous load; keep it that way with reserved space.
6. **Fonts.** About 450 KB of Inter across four files, plus Satoshi, with `max-age=0`. `font-display: swap` is already set. Ship one variable Inter file with the weights the UI uses, and a long cache on a versioned name. Same for Satoshi if headlines keep it.
7. **Cache for `public/` files.** Logos, mockups, and fonts revalidate on every visit. Long cache (`immutable` with a hash, or one year `max-age`) in `vercel.json`. `/_nuxt` is already correct.
8. **Public HTML cache, after confirmation.** Anonymous home, Discover, lists, movie, series, season, how-it-works, FAQ, and privacy are always `MISS` with `max-age=0`. A short `stale-while-revalidate` on those routes would drop the ~300 ms TTFB and, more importantly, the 4–6 s series documents. Signed-in home, watchlist, following, lists, preferences, and my-account stay uncached for sharing.
9. **Less JavaScript on the public home.** About 60 `modulepreload` hints load for a marketing page. Keep recommendations, auth, and title-detail code off that first load.
10. **Still open in `docs/engineering/network-performance.md`.** One videos response that includes the language fallback, instead of up to 3 calls. Collapse the `title-status` calls that fire in sequence after like, status, and undo. The global `user_title_status?liked=true` with `select=*` travels on every signed-in page; limit it to the columns the menu uses.

## Implementation status

### 1. Series document — per-season work removed from the show response

**File:** `server/api/tmdb/tvshows/[id].get.ts`

`GET /api/tmdb/tvshows/:id` used to, on every request and for every season:

- read that season row again (`name` and `overview`)
- write a missing name, episode count, or overview
- call TMDB for an English overview when the current language key was absent
- call `updateMissingSeasonFields`, which can fetch the season from TMDB when `air_date` is missing

That contradicts `docs/core/application-logic.md`: overview is fetched on demand when the season page is opened. `getSeasonsByTvTmdbId` already falls back to the region language and then to `en-US` for display.

The show handler now syncs missing season rows once (`syncSeasonsFromTVShow`, which returns immediately when rows are complete) and reads the season list once. The season page (`server/api/tmdb/tvshows/[id]/seasons/[season_id].get.ts`) still updates the single season that was opened.

`syncSeasonsFromTVShow` can still call TMDB once per season that is missing `air_date` or `episode_count`. For `37854` that path does not run. For `95557` it still runs for one season.

Deployed to the development alias `https://getupnext.vercel.app` in commit `1ad2e01`. Cold `curl` on 19 November 2026, `x-vercel-cache: MISS`:

| URL | Before (production) | After (preview) |
| --- | --- | --- |
| `/en/tv-show/37854` | 3.9 s | 1.76 s (161 KB HTML) |
| `/en/tv-show/95557` | 5.7 s | 1.74 s |
| `/api/tmdb/tvshows/37854?lang=en` | not split out | 1.20 s |
| `/api/tmdb/tvshows/95557?lang=en` | not split out | 1.15 s |
| `/en/movie/687163` | 0.61 s | 0.61 s |

The per-season loop is gone. What remains on the show response is the live TMDB show fetch, provider fetch, and one season read. That is about 1.2 s before Nuxt renders the HTML. The season page was not changed.

Preview is behind Vercel Authentication. Measurements used a short-lived share link on the deployment.
