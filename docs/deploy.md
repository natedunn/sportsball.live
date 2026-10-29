# Deploying

Cloudflare Workers Builds deploys every push to `natedunn/sportsball.live`.
`main` runs `scripts/cloudflare-deploy.sh`. Every other branch runs
`scripts/preview-build.sh` and then `wrangler preview`. The setup is the same
as Onda's.

| Branch | Convex | Worker | URL |
|---|---|---|---|
| `main` | prod, `harmless-coyote-806` | `wrangler deploy` | `https://sportsball.live` |
| anything else | a preview named after the branch | `wrangler preview --name <branch>` | `https://<branch>.preview.sportsball.live` |

The branch name becomes one DNS label: lowercased, anything outside
`[a-z0-9-]` turned into `-`, and cut to 40 characters (`feat/Lists` →
`feat-lists`). See `scripts/preview-name.sh`.

## How it works

- **Convex URLs are baked in at build.** `convex deploy --cmd` sets
  `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` for the build. Workers Builds
  needs no `VITE_*` variables.
- **The Worker reads the ESPN endpoints at runtime:** `{NBA,WNBA,GLEAGUE}_
  {SITE,CORE,COMMON}_API` (by name, in `src/lib/shared/league.ts`),
  `NBA_PLAYER_API`, `NBA_HEADSHOT_CDN` and `GLEAGUE_STATS_API`. They're stored
  as secrets on prod and in the Previews Base secrets for previews (previews
  don't inherit prod's settings), with the same values as prod Convex.
- **The gateway needs no registration.** A deployment signs its own address
  into the OAuth `state`, and the dev gateway accepts any `*.convex.site`.
  New previews sign in through `gateway-dev.sportsball.live` with no setup
  (docs/auth-environments.md).
- **Convex previews start from defaults.** Every new preview copies the
  project's preview defaults (`npx convex env default list --type preview`).
  These are written by `scripts/preview-defaults.sh`: cloud dev's settings
  plus a signing key pair just for previews. The build script then sets the
  one value that differs per branch, `SITE_URL`.
- **Previews fetch their own data.** On a preview's first deploy,
  `--preview-run bootstrap:fullBootstrap` loads teams, today's games and
  rosters from ESPN, and the crons keep it current. History before that day
  isn't there; use cloud dev or a local worktree for that.
- **Cleanup is automatic.** When a pull request closes or a branch is
  deleted, `.github/workflows/preview-cleanup.yml` runs
  `scripts/preview-delete.sh`, which deletes the branch's Worker Preview and
  Convex preview. As a backstop, Convex deletes previews after 5 days (Free)
  or 14 (Pro) without a deploy, and Cloudflare deletes the least recently
  deployed Worker Preview past 100 (Free) or 500 (Paid). To delete one by
  hand: `sh scripts/preview-delete.sh <branch>` with the two tokens below.

## Workers Builds settings

Workers & Pages → `sportsball` → Settings → Builds:

- Git repository: `natedunn/sportsball.live`, production branch `main`
- Build command: *(empty)*
- Deploy command: `sh scripts/cloudflare-deploy.sh`
- Preview command (Cloudflare requires it to call `npx wrangler preview`
  itself):
  `sh scripts/preview-build.sh && npx wrangler preview --name "$(sh scripts/preview-name.sh)"`
- Enable Preview builds: **on**. The Worker uses Worker Previews (the
  "Switch to Worker Previews" dialog), not the older preview versions, which
  ran with production settings.
- Build secret `CONVEX_DEPLOY_KEY` on each tab. Production and Previews Base
  keep separate secrets, so preview builds never see the prod key.
  - Production: the prod deploy key (`harmless-coyote-806` → Settings →
    Deploy keys)
  - Previews Base: a preview deploy key (project Settings → Preview deploy
    keys)
- No `VITE_*` build variables (see above).

## One-time setup

1. Preview defaults, after the dev gateway is set up on cloud dev
   (docs/auth-environments.md): `sh scripts/preview-defaults.sh`.
2. Previews Base secrets, copied from prod Convex (which holds the same
   values):

   ```sh
   for n in NBA_SITE_API WNBA_SITE_API GLEAGUE_SITE_API NBA_CORE_API \
     WNBA_CORE_API GLEAGUE_CORE_API NBA_COMMON_API WNBA_COMMON_API \
     GLEAGUE_COMMON_API NBA_PLAYER_API NBA_HEADSHOT_CDN GLEAGUE_STATS_API; do
     npx convex env get --prod $n | tr -d '\n' |
       npx wrangler preview base-config secret put $n
   done
   ```

3. Workers Builds as above.
4. Preview cleanup: two GitHub Actions secrets on `natedunn/sportsball.live`:
   - `CLOUDFLARE_PREVIEW_CLEANUP_TOKEN`: a Cloudflare API token with
     **Account → Workers Scripts → Edit** on the "Nate" account, nothing else
   - `CONVEX_MANAGEMENT_TOKEN`: a Convex team access token (team
     `nate-dunn` → Settings → Access Tokens)

## Changing settings

- **Prod Convex env:** `npx convex env set --prod NAME value` (pipe secrets in
  on stdin).
- **Preview defaults:** change the value on cloud dev, then re-run
  `sh scripts/preview-defaults.sh`. Only new previews get the change. For an
  existing preview, delete it or set the value there
  (`npx convex env --preview-name <name> set NAME value`).
- **Worker runtime secrets:** `npx wrangler secret put NAME` (prod), and
  `npx wrangler preview base-config secret put NAME` (new previews) or
  `npx wrangler preview secret put NAME --name <preview>` (one preview).
- **New `VITE_*` value:** export it in `scripts/cloudflare-deploy.sh` (prod)
  and/or `scripts/preview-build.sh` (previews).

## Deploying by hand

`pnpm release` deploys prod and `pnpm release:preview` previews the current
branch. Each needs the matching key in `CONVEX_DEPLOY_KEY`.

The gateways deploy separately and rarely: see `docs/auth-environments.md`.
