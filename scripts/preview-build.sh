#!/usr/bin/env sh
# Workers Builds preview command, before `npx wrangler preview` (Cloudflare
# requires the command itself to call it). See docs/deploy.md.
#
# Deploys a Convex preview named after the branch and builds the app against
# it. A new preview starts with the project's preview defaults (`npx convex
# env default list --type preview`, written by scripts/preview-defaults.sh)
# and fetches its league data from ESPN (bootstrap:fullBootstrap, on its
# first deploy only). Only the app's origin differs per branch.
set -eu

name="$(sh scripts/preview-name.sh)"
site="https://$name.preview.sportsball.live"

: "${CONVEX_DEPLOY_KEY:?CONVEX_DEPLOY_KEY (the preview deploy key) is not set}"
# --cmd also gets VITE_CONVEX_SITE_URL.
npx convex deploy --preview-name "$name" --preview-run bootstrap:fullBootstrap \
	--cmd "pnpm run build" --cmd-url-env-var-name VITE_CONVEX_URL
npx convex env --preview-name "$name" set SITE_URL "$site"
echo "Preview: $site"
