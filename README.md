# Texas RV and Mobile Home Park Research Tracker

Public collaborative research tracker deployed on Vercel and backed by a dedicated Supabase database.

The production tracker is intentionally public and editable without sign-in. Anyone with its URL can change research records.

This is a separate project from `texas-rv-development-map`. It includes the synchronized map and list, research workflow, imports and exports, duplicate review and merges, editable tab labels and pin colors, and complete audit history.

## Development

```bash
pnpm install
pnpm dev
```

Production build:

```bash
pnpm build
pnpm start
```

The public Supabase URL and publishable key may be supplied as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The application includes the current project values as public fallbacks; database access is controlled through Supabase Row Level Security policies.

## Location and radius search

Use **Search near a location** above the map to enter an address, city, or latitude and longitude. Set any positive radius up to 12,500 miles or choose a 5/10/25/50/100 mile preset. Submit **Search radius**. Results default to nearest first and show straight-line distances; the map displays the search center and radius circle. Status, property-type, county and text filters also apply. Properties without valid coordinates are excluded and counted. Clear the radius to return to statewide results.

Addresses resolve through the server-side `/api/geocode` route using Esri. Coordinate searches work without a geocoding request. Edits and cancellation abort pending lookups to prevent stale results.

Run radius regression checks with `node --test scripts/radius.test.mjs`, then `pnpm exec tsc --noEmit` and `pnpm build` before publishing.

Include `vendor/shadcn-tailwind-4.13.0.css` and its MIT license in source deployments. This stylesheet is sourced from shadcn-ui/ui's `shadcn@4.13.0` tag, `packages/shadcn/src/tailwind.css`. GitHub changes do not by themselves confirm a release: verify the Vercel build and production domain after deployment. If Git-source retrieval is unavailable, deploy the exact committed source files through Vercel's files API.
