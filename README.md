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
