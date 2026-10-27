# Local development

`pnpm dev` runs one checkout: its own local Convex backend and the app,
served through [Portless](https://github.com/vercel-labs/portless):

| Checkout | App | Convex backend |
|---|---|---|
| main (`~/Code/sportsball.live`) | `https://sportsball.localhost:1355` | `127.0.0.1:3250` / `3251` |
| any other worktree | `https://<folder>.sportsball.localhost:1355` | a pair in `20000`–`31999`, stable per worktree |

`<folder>` is the worktree's folder name, lowercased, with a leading
`sportsball-live-` or `sportsball-` dropped. Each checkout keeps its own data
in `.convex/local/default/`, so worktrees never share a database or fight over
which code is deployed. Run as many as you like at once.

## A new worktree

```sh
git worktree add ../sportsball-lists -b lists
cd ../sportsball-lists && pnpm dev
```

On the first run `scripts/dev.sh` installs dependencies and creates the local
backend. Then `scripts/dev-seed.sh` copies from cloud dev (`brilliant-wren-578`):

- **Settings:** Google OAuth client, dev gateway, signing keys, ESPN endpoints,
  `SUPER_ADMIN`.
- **League data:** teams, players, games, box scores and seasons (about 10 MB).
  Users, favorites and cached images are not copied.

Every run sets the backend's `SITE_URL` to the checkout's URL. The first push
waits for the settings and goes through by itself a few seconds later.

Sign-in works in every checkout. Google sends everyone to
`gateway-dev.sportsball.live`, which forwards to whichever local backend
started the sign-in, and that backend returns you to its own `SITE_URL`
(docs/auth-environments.md).

The local backend runs the crons too, so a checkout that stays running keeps
its own data current from ESPN.

## Changing dev settings

Set them on cloud dev, and new worktrees pick them up:

```sh
pbpaste | npx convex env set --deployment brilliant-wren-578 NAME
```

Existing checkouts keep what they were seeded with. Set it there too
(`npx convex env set NAME value` inside the checkout), or delete the
checkout's `.convex/local` to reseed, which also wipes its data.

## Cloud dev

`brilliant-wren-578` is the source for settings and data, and keeps syncing
from ESPN on its own. Push code to it with `pnpm push:cloud-dev`.

## Notes

- Portless's proxy runs on port 1355, shared with Onda and Kino. It starts on
  its own and needs no sudo. If the browser warns about the certificate, run
  `portless trust` once.
- `scripts/dev.sh` writes the checkout's `CONVEX_DEPLOYMENT` and
  `VITE_CONVEX_*` into `.env.local` before starting anything; other lines are
  kept. (If Convex wrote them later, Vite would restart, and the Cloudflare
  plugin can crash on that restart.)
- A checkout's backend is recognised by its data folder (`--local-storage
  <checkout>/.convex/local/default/…` in its command line). `pnpm dev` stops
  one left behind by a crashed run, refuses to start if the checkout is
  already running elsewhere, and stops its backend when it exits.
- `npx convex …` inside a checkout targets its local backend. Use
  `--prod` or `--deployment brilliant-wren-578` for the cloud deployments.
- Removing a worktree (`git worktree remove`) removes its data with it.
