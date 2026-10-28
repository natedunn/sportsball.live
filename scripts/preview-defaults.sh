#!/usr/bin/env sh
# Writes the project's Convex preview defaults, which every new preview
# deployment starts with: cloud dev's settings (dev Google client, dev gateway,
# ESPN endpoints, SUPER_ADMIN) minus SITE_URL, which scripts/preview-build.sh
# sets per branch, plus a signing key pair of the previews' own. Re-run after
# changing a dev setting; only new previews pick it up. See docs/deploy.md.
set -eu
source_deployment=brilliant-wren-578
export CONVEX_DEPLOYMENT="dev:$source_deployment"

umask 077
dir="$(mktemp -d)"
trap '/bin/rm -rf "$dir"' EXIT

# Not copied: the per-branch SITE_URL, cloud dev's own keys and URLs, and
# leftovers from Better Auth.
npx convex env list --include-values --deployment "$source_deployment" |
	grep -vE '^(SITE_URL|AUTH_PRIVATE_KEY|AUTH_JWKS|VITE_CONVEX_URL|VITE_CONVEX_SITE_URL|BETTER_AUTH_SECRET|CONVEX_ZEN_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET)=' > "$dir/env"
grep -q '^AUTH_GATEWAY_SECRET=' "$dir/env" || {
	echo "preview-defaults: set AUTH_GATEWAY_SECRET on $source_deployment first (docs/auth-environments.md)" >&2
	exit 1
}

node -e '
const {generateKeyPairSync, randomUUID} = require("crypto");
const {publicKey, privateKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
const jwk = publicKey.export({format: "jwk"});
const key = Buffer.from(privateKey.export({type: "pkcs8", format: "pem"})).toString("base64");
const jwks = JSON.stringify({keys: [{kty: jwk.kty, n: jwk.n, e: jwk.e, kid: randomUUID(), alg: "RS256", use: "sig"}]});
process.stdout.write(`AUTH_PRIVATE_KEY=${key}\nAUTH_JWKS='"'"'${jwks}'"'"'\n`);
' >> "$dir/env"

npx convex env default set --type preview --force --from-file "$dir/env" > /dev/null
echo "preview-defaults: wrote $(wc -l < "$dir/env" | tr -d ' ') preview defaults"
npx convex env default list --type preview --names-only
