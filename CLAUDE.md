# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development: this checkout's own local Convex backend + Vite through Portless
# (https://sportsball.localhost:1355, or https://<worktree>.sportsball.localhost:1355).
# Several worktrees can run at once. See docs/local-dev.md.
pnpm dev

# Push Convex functions to the shared cloud dev deployment (brilliant-wren-578)
pnpm push:cloud-dev

# Build for production
pnpm build

# Deploy by hand (Workers Builds normally does this; see docs/deploy.md)
pnpm release           # prod Convex + sportsball.live
pnpm release:preview   # Convex preview + <branch>.preview.sportsball.live

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
- **Auth**: Convex Auth v2 (beta, patched) with Google OAuth through a per-tier gateway Worker (`workers/gateway`). See docs/auth-environments.md
- **Styling**: Tailwind CSS v4
- **Deployment**: Cloudflare Workers (via Vite plugin), via Workers Builds: `main` → prod, other branches → Worker Previews with a Convex preview each. See docs/deploy.md

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
- `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL` - baked in at build (`pnpm dev` and the deploy scripts set them)
- ESPN API endpoints (per league: NBA, WNBA, GLEAGUE):
  - `*_SITE_API` - Main site API (scoreboard, games, teams, news)
  - `*_CORE_API` - Core API (detailed injuries)
  - `*_COMMON_API` - Common API (roster with player stats)
- Auth settings live on the Convex deployments, not in `.env` (docs/auth-environments.md)
