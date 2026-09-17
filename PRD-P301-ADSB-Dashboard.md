# PRD: P301 — ADS-B Dashboard: Overhead

**Status:** Draft  
**Author:** Carl Hoffnagle  
**Created:** 2026-09-16  
**Last Updated:** 2026-09-16 (rev 4 — OQ-2 through OQ-6 resolved)  

---

## 1. Overview

### 1.1 Problem Statement

Aviation enthusiasts have no simple, shareable way to see which aircraft are currently flying overhead their location in real time. Commercial flight trackers (FlightRadar24, FlightAware) are ad-supported, opaque, and cannot be customized or embedded. A lightweight, publicly-accessible ADS-B overhead dashboard fills this gap.

### 1.2 Project Summary

Build a real-time overhead aircraft dashboard hosted on Vercel, that proxies the [adsb.fi](https://opendata.adsb.fi) open data API through a serverless edge cache, displays aircraft within a configurable radius of the user's current location, and presents the data in both a live map view and a sortable data table. Location is resolved automatically from the browser; if unavailable, the user is prompted to enter their ZIP code. The app is accessible by URL to a limited public audience.

### 1.3 Goals

- Display all aircraft currently within a configurable radius (default: 50 NM) of the user's location — sourced automatically from the browser's Geolocation API, with a ZIP code prompt as fallback if geolocation is unavailable or denied
- Refresh data automatically, respecting the adsb.fi rate limit (1 req/sec) — even across concurrent users
- Require no paid API key, no external accounts, and no persistent backend database
- Deploy to Vercel with a single `vercel deploy` command
- Accessible publicly by URL; no login required for viewers

### 1.4 Non-Goals

- Historical flight playback or logging
- Saving or persisting a user's location between sessions (v1: location resolved fresh on each page load)
- Mobile-optimized responsive design (desktop-first)
- Push notifications or alerting (future scope)
- Commercial use (adsb.fi terms prohibit it)
- User authentication / access control beyond obscure URL (v1)

---

## 2. Users & Context

| Persona | Description |
|---|---|
| Any viewer | Anyone with the URL; the dashboard resolves their location automatically and shows overhead traffic for their position |

**Deployment context:** Vercel (serverless). Public URL. No login required. Each viewer's location is resolved client-side via the browser Geolocation API (or ZIP code entry). The search radius and poll interval are configured at deploy time via environment variables and are the same for all viewers.

---

## 3. Data Source

### 3.1 adsb.fi Open Data API

| Property | Value |
|---|---|
| Base URL | `https://opendata.adsb.fi/api/` |
| Auth required | None |
| Rate limit | 1 request per second (public endpoints) |
| Use terms | Personal, non-commercial only. Must cite adsb.fi with link to homepage. |
| Coverage | Global, crowd-sourced ADS-B receiver network |

### 3.2 Primary Endpoint

```
GET /v3/lat/{lat}/lon/{lon}/dist/{dist}
```

Returns all aircraft within `dist` nautical miles of the given lat/lon. Max radius: **250 NM**.

**Example:**
```bash
curl https://opendata.adsb.fi/api/v3/lat/47.6062/lon/-122.3321/dist/50
```

### 3.3 Key Response Fields (per aircraft)

| Field | Type | Description |
|---|---|---|
| `hex` | string | ICAO 24-bit Mode-S address (unique aircraft ID) |
| `flight` | string | Callsign / flight number |
| `r` | string | Registration (tail number) |
| `t` | string | Aircraft type code (e.g., `B738`) |
| `lat` | float | Current latitude |
| `lon` | float | Current longitude |
| `alt_baro` | int | Barometric altitude (feet) |
| `alt_geom` | int | Geometric altitude (feet) |
| `gs` | float | Ground speed (knots) |
| `track` | float | True track / heading (degrees) |
| `baro_rate` | int | Vertical rate (feet/min) |
| `squawk` | string | Transponder squawk code |
| `category` | string | ADS-B emitter category (e.g., `A3` = large airliner) |
| `seen` | float | Seconds since last message |
| `rssi` | float | Signal strength (dBFS) |
| `dst` | float | Distance from query point (NM) |
| `dir` | float | Bearing from query point (degrees) |

### 3.4 Rate Limit Strategy — Critical for Multi-User Deployment

Because Vercel is serverless with no shared memory between function invocations, **multiple concurrent users would each trigger independent adsb.fi requests** without a shared cache — easily violating the 1 req/sec limit and risking IP block.

The solution is **Next.js Data Cache** via the native `fetch` API with `revalidate`:

```ts
// In the /api/aircraft route handler
const res = await fetch(adsbUrl, { next: { revalidate: 10 } });
```

- Next.js / Vercel's infrastructure caches the `fetch` response at the CDN/edge layer, shared across all serverless function instances in the same region
- Cache TTL: **10 seconds** (`revalidate: 10`) — matches the default poll interval
- On cache miss (first request or after TTL expires): fetches from adsb.fi and populates the cache
- On cache hit: returns immediately with no adsb.fi call made
- No external service, SDK, or additional environment variables required
- If a 429 is received from adsb.fi: return an error response to the client (do not cache the error — let the next request retry)

**⚠️ Cache efficiency with per-user locations:** Because each user may have a different lat/lon, each unique coordinate pair produces a different adsb.fi URL and a separate cache entry. To prevent cache fragmentation and keep adsb.fi call volume low, **the API layer rounds incoming coordinates to 2 decimal places** (~1.1 km precision) before constructing the adsb.fi URL. Users within ~1 km of each other share a cache entry. This rounding is transparent to the frontend and has no meaningful effect on the displayed result given the 50 NM default radius.

> **Runtime Cache note:** `@vercel/functions` also exposes a `getCache` helper for key-value caching within functions. This is a valid alternative but is better suited for non-`fetch` data sources (e.g., database queries, computed values). Since adsb.fi is a plain HTTPS endpoint, the native `fetch` Data Cache is the idiomatic and simpler choice.

---

## 4. Features & Requirements

### 4.1 Core Features (MVP)

#### F-01: Location Detection

The user's location is resolved client-side on page load using the following priority order:

1. **Browser Geolocation API** — the browser requests permission and returns lat/lon
   - If granted: use the coordinates immediately, proceed to load the map
2. **ZIP code fallback** — if geolocation is denied, unavailable, or times out:
   - Display a modal prompt asking the user to enter their ZIP code
   - Geocode the ZIP to a lat/lon centroid via a free geocoding API (see Section 7 — open question)
   - Validate the ZIP before submitting (5-digit US format in v1)
3. On successful resolution by either method: center the map on the resolved location and begin polling

The resolved lat/lon is held in React state for the session. It is not persisted to localStorage in v1.

#### F-01b: App-Level Configuration (Server)

- Search radius and poll interval are server-configured via **Vercel environment variables**:
  - `RADIUS_NM` — default `50`, max `250`
  - `POLL_INTERVAL_SEC` — default `10`, min `5`
- These values are the same for all viewers; exposed to the frontend as build-time constants

#### F-02: Live Map View

- Interactive map centered on the user's resolved location
- User's location marked with a distinct pin/icon
- Each aircraft rendered as a directional arrow/icon rotated to match its `track` heading
- Aircraft icons colored by altitude band:
  - Ground / < 1,000 ft: gray
  - 1,000–10,000 ft: yellow
  - 10,000–25,000 ft: green
  - 25,000–30,000 ft: cyan
  - 30,000–35,000 ft: blue
  - ≥ 35,000 ft: violet
- **Hovering** over an aircraft icon opens a detail popup showing: callsign, registration, type, altitude, speed, heading, distance, squawk
- **Clicking** an aircraft icon selects it and draws its flight track as a dashed line connecting its previously recorded positions (accumulated across poll cycles during the session)
  - Only one track is shown at a time
  - Clicking a different aircraft icon clears the previous track and draws the newly selected aircraft's track
  - Clicking anywhere on the map where there is no aircraft icon clears the active track
  - If an aircraft has only one recorded position (first poll), no track line is drawn
- Radius ring drawn around the user's resolved location
- Map auto-refreshes aircraft positions on each poll cycle (no full page reload)
- **Aircraft visibility rules:**
  - Aircraft remain visible on the map while a poll is in flight (i.e., during a normal refresh cycle)
  - An aircraft is removed from the map when it no longer appears in the latest adsb.fi response, OR when its `seen` value exceeds **60 seconds** (indicating stalled / non-updating telemetry)
  - If a selected (tracked) aircraft is removed, its track is also cleared
  - The `seen` threshold of 60s is a server-injected constant; no UI toggle in v1

#### F-03: Aircraft Table

- Tabular list of all currently tracked aircraft (mirrors map visibility rules: only aircraft with `seen` ≤ 60s and present in the latest response)
- Columns: Callsign, Registration, Type, Altitude (ft), Speed (kts), Heading (°), Distance (NM), Bearing (°), Vertical Rate (fpm), Squawk
- Client-side sortable by any column
- Row count shown: "Showing N aircraft within X NM"

#### F-04: Status Bar

- Last poll timestamp
- Poll status: OK / Error / Rate-limited
- Total aircraft count
- Attribution: "Data: [adsb.fi](https://adsb.fi)" (required by terms)

#### F-05: Auto-Refresh

- Frontend polls `/api/aircraft` on the configured interval (`POLL_INTERVAL_SEC`)
- Visual indicator (spinner or pulsing dot) during fetch
- No page reload required; DOM updates in place
- Frontend respects `cache_age_sec` in the response to show data freshness

### 4.2 Stretch Features (Post-MVP)

| ID | Feature | Notes |
|---|---|---|
| S-01 | Filter by aircraft category | Airliners only, GA only, military, etc. |
| S-02 | Highlight / alert on specific callsigns or registrations | Watch list |
| S-03 | Aircraft trail (last N positions) | Requires Vercel KV position history |
| S-04 | Export current aircraft list to CSV | One-click download |
| S-05 | Dark mode | CSS variable toggle |
| S-06 | Altitude histogram chart | Distribution of overhead traffic by altitude band |
| S-07 | Password-protect the URL | Vercel middleware + env-var secret |
| S-08 | De-clutter mode | Single toggle strips view to map + aircraft only; hides table, status bar text, radius ring, graticule (see §5.7) |

---

## 5. Design System & Aesthetics

### 5.1 Philosophy: Dark Cockpit

The dashboard is modeled on modern flight deck Primary Flight Displays (PFDs) and Navigation Displays (NDs). The guiding principle is **functional minimalism under high stakes**: every pixel earns its place, every color carries a specific meaning, and silence (the absence of visual noise) is itself a signal.

> "If a system is working perfectly, its indicator is off. No news is good news."

The UI should feel like an instrument, not an app.

---

### 5.2 Color Palette

Color is never decorative. It is a triage tool. The dashboard uses the aviation-standard color semantic system:

| Color | Hex (approx.) | Meaning | Usage |
|---|---|---|---|
| **Black** | `#000000` / `#0a0a0a` | Background — the absence of data | Page and panel backgrounds |
| **Magenta** | `#FF00FF` / `#CC00CC` | Active automated path | Selected aircraft flight track line |
| **Green** | `#00FF66` / `#39FF14` | Healthy, operating, nominal | Aircraft icons at cruise altitude; OK status indicator |
| **Cyan** | `#00FFFF` / `#00D4D4` | Non-urgent status / background data | Radius ring; historical track ghost; UI labels |
| **White** | `#FFFFFF` / `#E0E0E0` | Primary data readout | Aircraft callsigns; table data values |
| **Amber** | `#FFB300` / `#FFA500` | Caution — needs attention | Aircraft with `seen` > 30s; rate-limit warning in status bar |
| **Red** | `#FF2200` / `#FF0000` | Warning — immediate action | API error / adsb.fi unreachable; aircraft with `seen` > 60s before removal |
| **Gray** | `#333333` / `#555555` | Inactive / muted | Grid lines; dividers; disabled states |

**Altitude-band color overrides aircraft icon color:**

| Altitude | Icon Color |
|---|---|
| Ground / < 1,000 ft | Gray (`#555555`) |
| 1,000–10,000 ft | Amber (`#FFB300`) |
| 10,000–25,000 ft | Green (`#39FF14`) |
| 25,000–29,999 ft | Cyan (`#00FFFF`) |
| 30,000–34,999 ft | Blue (`#00A6FF`) |
| 35,000+ ft | Violet (`#8B5CF6`) |

---

### 5.3 Typography

| Role | Font | Style | Notes |
|---|---|---|---|
| Primary data (callsigns, altitudes, speeds) | `B612 Mono` or `Share Tech Mono` | Regular, monospaced | Aviation-standard monospace; legible at small sizes |
| Labels and headers | `B612` or `Rajdhani` | Medium weight, all-caps | Clean, blocky sans-serif |
| Status bar text | Same as labels | Uppercase, tight letter-spacing | |

All text is uppercase or small-caps. No serif fonts. No italic text. Monospace for all numeric data readouts.

---

### 5.4 Map Styling

- **Base tile:** Dark/night map tile — use [CartoDB Dark Matter](https://carto.com/basemaps/) (free, no API key) instead of the default OpenStreetMap tile. This provides a near-black base with muted geographic outlines consistent with the Dark Cockpit aesthetic.
- **Grid lines:** Faint gray (`#222222`) lat/lon graticule lines, low opacity — structural reference without visual noise
- **Radius ring:** Dashed cyan circle; 1px stroke; low opacity (~50%) — present but not dominant
- **Home/user pin:** Cyan crosshair icon — simple, geometric, no drop shadow
- **Aircraft icons:** Flat directional arrows (filled triangle or chevron); rotated to `track` heading; colored by altitude band (see §5.2); no drop shadow
- **Selected aircraft track:** Dashed magenta polyline; 2px stroke; drawn through all recorded positions from the current session

---

### 5.5 Layout & Grid

- **Background:** `#000000` or `#080808` — pitch black
- **Panel borders:** Single-pixel lines in dark gray (`#1f1f1f`) or dim cyan; no rounded corners; no card shadows
- **Layout:** Strict grid alignment. Two-pane layout: map (left/primary, ~65% width) and data panel (right, ~35% width) containing the aircraft table and status bar
- **Spacing:** Tight but breathable — dense data without clutter; use consistent 4px or 8px base grid unit
- **No gradients.** No drop shadows. No blur effects. No animations beyond functional transitions (icon position updates, track line drawing)

---

### 5.6 Interaction Design

| Interaction | Behavior |
|---|---|
| Hover over aircraft icon | Show tooltip/popup with: callsign, registration, type, altitude, speed, heading, distance, squawk — styled as a dark panel with cyan/white monospace text |
| Click aircraft icon | Select aircraft; draw magenta dashed track line from session position history |
| Click different aircraft icon | Clear previous track; draw new track for clicked aircraft |
| Click empty map area | Clear active track selection; no other effect |
| Status bar — OK | Green dot + "LIVE" label |
| Status bar — Refreshing | Pulsing amber dot (no spinner animation — a slow pulse is sufficient) |
| Status bar — Rate limited | Amber text "RATE LIMITED — RETRYING" |
| Status bar — Error | Red dot + "FEED OFFLINE" |
| Aircraft removed (seen > 60s) | Icon fades out over 1s then is removed — not an abrupt disappearance |

---

### 5.7 De-clutter Mode (Stretch — S-08)

Inspired by the aviation ND de-clutter toggle: a single button strips the view to map + aircraft icons only, hiding the table panel, status bar text, radius ring, and graticule. A second press restores full layout. This is a post-MVP feature but the layout should be architected to support it from the start.

---

## 6. Architecture

### 5.1 Recommended Stack

> **Why the stack changed from the local-deployment version:** Vercel is a serverless platform. There is no persistent process, no shared memory between invocations, and no background polling task. The FastAPI + in-memory cache approach used for local deployment does not work here. The stack below is purpose-built for Vercel's execution model.

| Layer | Technology | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | First-class Vercel support; API Routes become serverless functions automatically |
| Language | **TypeScript** | Type safety across frontend and API layer |
| API proxy/cache | **Next.js Data Cache** (`fetch` + `revalidate`) | Native Vercel distributed cache; no external service or SDK required |
| Frontend | **React** (via Next.js) | Co-located with API; no separate hosting needed |
| Map | **Leaflet.js** (via `react-leaflet`) | Free, open-source, no API key |
| Map tiles | **CartoDB Dark Matter** (via Leaflet tile URL) | Free, no key required; pitch-black base consistent with Dark Cockpit aesthetic |
| Location | **Browser Geolocation API + ZIP geocoding** | Client-side; no server config needed for location |
| Config | **Vercel Environment Variables** | Radius and poll interval set in Vercel dashboard |
| Package mgmt | `npm` + `package.json` | Standard for Next.js |
| Deployment | **Vercel CLI** (`vercel deploy`) | One-command deploy; preview URLs per branch |

### 5.2 Next.js Data Cache — Cache Layer

Next.js Data Cache is built into the framework and managed by Vercel's infrastructure at no additional cost:

| Property | Value |
|---|---|
| Cost | Free — no external service |
| Mechanism | `fetch(..., { next: { revalidate: N } })` in a Server Component or Route Handler |
| TTL | `POLL_INTERVAL_SEC` (default 10s) |
| Scope | Distributed across all function instances in the same Vercel region |
| Invalidation | Automatic on TTL expiry; can also be manually purged via `revalidatePath` or `revalidateTag` |
| Dependencies | None — built into Next.js, no SDK or env vars needed |

> **Note on Upstash Redis:** Vercel's original KV product was sunset and migrated to Upstash Redis via the Vercel Marketplace. Upstash remains a valid option if more control over cache keys, TTLs, or cross-region sharing is needed in the future, but it is unnecessary for this use case.

### 5.3 Component Diagram

```
┌────────────────────────────────────────────────────────────┐
│                      Browser (Public URL)                   │
│                                                             │
│  1. Geolocation API → lat/lon                               │
│     (or ZIP prompt → geocode → lat/lon)                     │
│                                                             │
│  ┌─────────────────┐   ┌───────────────────────────────┐   │
│  │   Map View      │   │       Aircraft Table          │   │
│  │ (react-leaflet) │   │       (React / TS)            │   │
│  └────────┬────────┘   └──────────────┬────────────────┘   │
│           │  fetch /api/aircraft       │                    │
│           │  ?lat=XX&lon=YY&dist=50   │                    │
│           └──────────────┬────────────┘                    │
└──────────────────────────│──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼─────────────────────────────────┐
│              Vercel Serverless Function                      │
│         /api/aircraft  (Next.js Route Handler)              │
│                                                             │
│  Rounds lat/lon to 2 decimal places                         │
│  fetch(adsbUrl, { next: { revalidate: 10 } })               │
│                                                             │
│  Cache HIT  → Next.js Data Cache returns stored response    │
│  Cache MISS → fetches adsb.fi, populates cache, returns     │
└──────────┬────────────────────────────┬────────────────────┘
           │                            │
  ┌────────▼──────────────┐   ┌─────────▼──────────┐
  │  Next.js Data Cache   │   │  opendata.adsb.fi   │
  │  (Vercel CDN layer)   │   │  /v3/lat/lon/dist   │
  │  TTL: 10s, no cost    │   │  (called ≤1/10s     │
  │  keyed by rounded     │   │   per unique area)  │
  │  lat/lon/dist         │   └────────────────────┘
  └───────────────────────┘
```

### 5.4 Data Flow

1. Browser loads the Next.js app from Vercel CDN
2. App requests location via the **Browser Geolocation API**
   - Granted → lat/lon available; proceed to step 4
   - Denied/unavailable → display **ZIP code prompt modal**
3. User enters ZIP → frontend calls a free geocoding API to convert ZIP to lat/lon centroid
4. React app begins polling `/api/aircraft?lat={lat}&lon={lon}&dist={radius}` every `POLL_INTERVAL_SEC` seconds
5. Next.js Route Handler **rounds lat/lon to 2 decimal places**, then calls `fetch(adsbUrl, { next: { revalidate: 10 } })`
6. **Cache HIT (within 10s TTL):** Next.js Data Cache returns the stored response — no adsb.fi request made
7. **Cache MISS (TTL expired or first request):** Fetches live data from adsb.fi, populates Data Cache, returns to client
8. React frontend updates map markers and table rows; no page reload
9. On 429 from adsb.fi: Route Handler returns an error response; frontend shows "rate limited" in status bar; next poll retries normally

---

## 7. API Contract (Internal)

### `GET /api/aircraft?lat={lat}&lon={lon}&dist={dist}`

Returns the current overhead aircraft snapshot for the given location (from cache or live fetch). The server rounds `lat`/`lon` to 2 decimal places before querying adsb.fi.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `lat` | float | ✅ | User latitude (decimal degrees) |
| `lon` | float | ✅ | User longitude (decimal degrees) |
| `dist` | integer | ❌ | Search radius in NM (default: server `RADIUS_NM`; max 250) |

**Response:**
```json
{
  "timestamp": "2026-09-16T14:32:01Z",
  "cache_age_sec": 4,
  "status": "ok",
  "query": { "lat": 47.61, "lon": -122.33, "radius_nm": 50 },
  "aircraft_count": 12,

  "aircraft": [
    {
      "hex": "a1b2c3",
      "flight": "AAL123",
      "r": "N12345",
      "t": "B738",
      "lat": 47.72,
      "lon": -122.10,
      "alt_baro": 28500,
      "gs": 412,
      "track": 275,
      "baro_rate": -64,
      "squawk": "1200",
      "dst": 14.3,
      "dir": 42.1,
      "seen": 2.1
    }
  ]
}
```

**Error response:**
```json
{
  "timestamp": "2026-09-16T14:32:01Z",
  "cache_age_sec": null,
  "status": "error",
  "error": "rate_limited",
  "retry_after_seconds": 30,
  "aircraft": []
}
```

### `GET /api/health`

Returns `{ "status": "ok" }`. Used for Vercel health checks and uptime monitors.

---

## 8. Environment Variables

Set in the Vercel project dashboard (Settings → Environment Variables). Never committed to the repository.

| Variable | Required | Default | Description |
|---|---|---|---|
| `RADIUS_NM` | ❌ | `50` | Default search radius in nautical miles (max 250); used when `dist` param is omitted from API call |
| `POLL_INTERVAL_SEC` | ❌ | `10` | Frontend polling interval in seconds (min 5); injected as a build-time constant |

> `HOME_LAT`, `HOME_LON`, and `HOME_LABEL` are no longer needed — location is resolved client-side per user. No cache-related environment variables are required either; Next.js Data Cache is configured entirely in code.

A `.env.local.example` file is committed to the repo with placeholder values for local development.

---

## 9. Project Structure

```
p301-adsb-dashboard/
├── public/
│   └── robots.txt               # Disallow all crawlers (User-agent: * / Disallow: /)
├── .env.local.example           # Env var template (committed; actual values gitignored)
├── next.config.ts               # Next.js config
├── package.json
├── tsconfig.json
├── vercel.json                  # Vercel project config (region, headers, etc.)
│
├── app/                         # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Main dashboard page
│   ├── globals.css
│   │
│   └── api/
│       ├── aircraft/
│       │   └── route.ts         # GET /api/aircraft — adsb.fi proxy + KV cache
│       └── health/
│           └── route.ts         # GET /api/health
│
├── components/
│   ├── AircraftMap.tsx          # react-leaflet map component
│   ├── AircraftTable.tsx        # Sortable aircraft table
│   ├── StatusBar.tsx            # Poll status + attribution
│   ├── LocationGate.tsx         # Wrapper: triggers geolocation or shows ZIP prompt
│   └── ZipPrompt.tsx            # Modal: ZIP code input + geocoding call
│
├── lib/
│   ├── adsb.ts                  # adsb.fi fetch logic + response types
│   │                            # (uses fetch with { next: { revalidate: 10 } } — no separate cache helper needed)
│   └── geocode.ts               # ZIP → lat/lon via OpenStreetMap Nominatim
│
└── types/
    └── aircraft.ts              # Shared TypeScript types
```

---

## 10. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Cold start latency | < 500ms (Vercel serverless) |
| Cached response latency | < 100ms (Next.js Data Cache hit) |
| Frontend refresh latency | < 500ms from API response to DOM update |
| External service dependencies | None for caching — Next.js Data Cache is infrastructure-native |
| Browser compatibility | Chrome / Firefox / Safari latest |
| Offline resilience | Show last known data + "data may be stale" banner if adsb.fi unreachable |

---

## 11. Legal & Attribution

Per adsb.fi terms of service:
- This project is for **personal, non-commercial use only**
- Public accessibility via URL does not make it commercial, provided no revenue is generated and data is not resold
- The dashboard UI **must** display "Data: adsb.fi" with a hyperlink to `https://adsb.fi` — displayed persistently in the status bar
- Data may not be resold, licensed, or used in a commercial product

> **⚠️ Terms Advisory:** Broad public access to a service that proxies adsb.fi data could be interpreted as exceeding personal use. Keep the audience limited (link-sharing only, no indexing). A `robots.txt` blocking all crawlers is included in the project to minimize unnecessary traffic and API calls.

---

## 12. Milestones

| Milestone | Scope |
|---|---|
| M1 — Skeleton | Next.js project scaffolded; `/api/aircraft?lat&lon&dist` returning live adsb.fi data with Data Cache |
| M2 — Location & Table | Browser geolocation + ZIP fallback; aircraft table with sort; status bar; auto-refresh |
| M3 — Map View | react-leaflet map with aircraft icons, user location pin, radius ring, click popups |
| M4 — Deploy & Polish | Vercel deploy, error states, stale data warnings, robots.txt, geolocation permission UX |

---

## 13. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | ~~What is the target home location?~~ | — | **Resolved** — location sourced from browser geolocation / ZIP fallback |
| OQ-2 | ~~Should stale aircraft be hidden or flagged?~~ | — | **Resolved** — aircraft remain visible during active polling; removed when absent from latest response or `seen` > 60s |
| OQ-3 | ~~Password protection vs. URL obscurity?~~ | — | **Resolved** — URL obscurity sufficient for v1 |
| OQ-4 | ~~Which Vercel plan?~~ | — | **Resolved** — Hobby (free) |
| OQ-5 | ~~Should `robots.txt` block all crawlers?~~ | — | **Resolved** — yes; `robots.txt` (Disallow: /) included in project |
| OQ-6 | ~~Which geocoding service for ZIP → lat/lon?~~ | — | **Resolved** — OpenStreetMap Nominatim; revisit if rate limiting becomes an issue |

---

## 14. References

- [adsb.fi Open Data API](https://github.com/adsbfi/opendata/blob/main/README.md)
- [adsb.fi Homepage](https://adsb.fi)
- [Next.js Data Cache Documentation](https://nextjs.org/docs/app/building-your-application/caching#data-cache)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Vercel `@vercel/functions` Runtime Cache](https://vercel.com/docs/functions/runtimes) *(alternative cache option for non-fetch data sources)*
- [CartoDB Dark Matter Basemap](https://carto.com/basemaps/) *(free dark map tile layer)*
- [B612 Font](https://b612-font.com/) *(aviation-designed monospace typeface, open source)*
- [react-leaflet Documentation](https://react-leaflet.js.org/)
- [Leaflet.js Documentation](https://leafletjs.com/reference.html)
- [OpenStreetMap Nominatim API](https://nominatim.openstreetmap.org/ui/about.html) *(ZIP → lat/lon geocoding)*
- [ADS-B Exchange v2 API Docs](https://www.adsbexchange.com/api/aircraft/v2/docs/) *(adsb.fi response format is compatible)*
