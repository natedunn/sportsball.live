# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts Convex and Vite in parallel)
pnpm dev

# Run only the web server (port 3000)
pnpm dev:web

# Run only Convex dev server
pnpm dev:convex

# Build for production
pnpm build

# Build and deploy (includes Convex deployment)
pnpm build:deploy

# Linting
pnpm lint

# Type checking
pnpm tsc

# Tests
pnpm test           # Run once
pnpm test:watch     # Watch mode
```

## Architecture

### Stack
- **Framework**: TanStack Start (React meta-framework with file-based routing)
- **Routing**: TanStack Router with SSR query integration
- **State/Data**: TanStack Query + Convex (real-time database)
- **Auth**: Better Auth with Convex adapter, Google OAuth
- **Styling**: Tailwind CSS v4
- **Deployment**: Cloudflare Workers (via Vite plugin)

### Directory Structure
- `src/routes/` - File-based routing (TanStack Router)
  - `__root.tsx` - Root layout with providers
  - `_default/` - Layout route with header
  - `api/` - API routes (logo proxies, auth)
- `src/lib/` - Business logic organized by league (nba, wnba, gleague)
  - `*.server.ts` - Server functions using `createServerFn`
  - `*.queries.ts` - TanStack Query options
- `src/convex/` - Convex backend (schema, functions)
- `src/components/` - React components

### Data Flow Pattern
Each league (NBA, WNBA, G-League) follows the same pattern:
1. `games.server.ts` - Server function to fetch scoreboard data
2. `games.queries.ts` - Query options with smart stale time (30s for today, 5min for past)
3. `game-details.server.ts` - Server function for individual game details
4. `team-utils.server.ts` - Team colors and logo URL processing
5. `team-logos.ts` - Static team slug to logo URL mapping

### Key Patterns
- **Logo Proxy**: External logo URLs are mapped through `/api/{league}/logo/{slug}` routes to hide CDN origins
- **Server Functions**: Use `createServerFn` from TanStack Start for server-side data fetching
- **Query Integration**: Routes use `loader` with `ensureQueryData` for SSR, components use `useQuery`
- **Dark/Light Colors**: Teams have both `darkColor` and `lightColor` - components use `useIsDarkMode` hook to select appropriate color

### Path Aliases
- `@/*` → `./src/*`
- `@convex/*` → `./src/convex/*`
- `~api` → `./src/lib/api.ts` (Convex API re-export)

### Environment Variables
Required variables (see `.env.example`):
- `VITE_CONVEX_URL` - Convex deployment URL
- `NBA_API_BASE`, `WNBA_API_BASE`, `GLEAGUE_API_BASE` - Sports data API endpoints
- `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Auth config
