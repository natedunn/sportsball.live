#!/usr/bin/env sh
# Workers Builds deploy command (main): prod Convex (harmless-coyote-806), then
# the Worker on sportsball.live. Previews: scripts/preview-build.sh. See
# docs/deploy.md.
set -eu

: "${CONVEX_DEPLOY_KEY:?CONVEX_DEPLOY_KEY (the prod deploy key) is not set}"
# --cmd also gets VITE_CONVEX_SITE_URL.
npx convex deploy --cmd "pnpm run build" --cmd-url-env-var-name VITE_CONVEX_URL
npx wrangler deploy
