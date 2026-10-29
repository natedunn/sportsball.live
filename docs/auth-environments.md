# Auth environments

Sign-in is Google only, through Convex Auth v2 (`@convex-dev/auth@2.0.0-beta.0`,
pinned and patched). The setup follows Onda's: one OAuth client per tier, and
a gateway Worker per tier that forwards Google's callback to whichever Convex
deployment started the sign-in.

## Tiers

| Tier | Serves | Gateway | Google client |
|---|---|---|---|
| Dev | local worktrees, cloud dev (`brilliant-wren-578`), branch previews | `https://gateway-dev.sportsball.live` | the dev client (`GOOGLE_CLIENT_ID` on cloud dev) |
| Prod | sportsball.live, prod Convex (`harmless-coyote-806`) | `https://gateway.sportsball.live` | the prod client |

Each Google client has exactly one redirect URI, and it never changes:

| Tier | Authorized redirect URI |
|---|---|
| Dev | `https://gateway-dev.sportsball.live/oauth/google/callback` |
| Prod | `https://gateway.sportsball.live/oauth/google/callback` |

We request `openid`, `email` and `profile`, use the profile once at sign-in,
and never store Google's tokens.

## How a sign-in flows

1. `auth:startSignInWithGoogle` (`viaGateway` in `src/convex/authGateway.ts`)
   runs the package's start, then prefixes `state` in Google's URL with
   `<b64url(CONVEX_SITE_URL)>.<b64url(HMAC(secret, "google\n" + site))>.`.
   The browser keeps the plain state. `redirect_uri` is the gateway (patch).
2. Google redirects to `<gateway>/oauth/google/callback`.
3. The gateway (`workers/gateway`) checks the HMAC with `ROUTING_SECRET` and
   the target against `ALLOWED_TARGETS`, then 302s to
   `<target>/oauth/google/callback` with the plain state. It holds no Google
   credentials. Callbacks are rate limited per IP.
4. The deployment's stock callback exchanges the code (sending the gateway
   URL as `redirect_uri`, matching step 1) and returns the browser to the app
   origin that started the sign-in. That origin must be in the deployment's
   `SITE_URL` (exact match; comma-separate several).

`createUser` (`src/convex/users.ts`) links a Google account to an existing
`profile` row by verified email, so profiles from Better Auth carry over.

## What we carry on top of the package

| Thing | Where | Remove when |
|---|---|---|
| **Patch:** optional `CALLBACK_URL` component env | `patches/@convex-dev__auth.patch` | Upstream supports a configurable callback (convex-auth#1) |
| `viaGateway` wrapper (calls the package's mutation through the undocumented `_handler`) | `src/convex/authGateway.ts` | Same |
| Gateway Worker | `workers/gateway` | Same |
| SPA-mode client, client-side route guards | `src/routes/__root.tsx`, `src/lib/auth/require-auth.tsx` | A framework-agnostic SSR adapter ships (or adopt Onda's `src/lib/convex-auth-start`) |

The patch is Onda's. When upgrading the package, check it still applies
(`pnpm install` fails if it doesn't) and read Onda's `docs/convex-auth.md`
upstream tracking section, which covers the same package.

## Deployment settings

Each tier has one routing secret, shared by its gateway and every deployment
in the tier. Generate it once per tier (`openssl rand -base64 32`) and keep it
in the password manager. Pipe secrets in so they stay out of shell history.

| Variable | Cloud dev | Prod |
|---|---|---|
| `AUTH_PRIVATE_KEY`, `AUTH_JWKS` | dev key pair | its own key pair |
| `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` | dev client | prod client |
| `AUTH_GATEWAY_SECRET` | dev routing secret | prod routing secret |
| `AUTH_GOOGLE_CALLBACK_URL` | `https://gateway-dev.sportsball.live/oauth/google/callback` | `https://gateway.sportsball.live/oauth/google/callback` |
| `SITE_URL` | `http://localhost:3000` | `https://sportsball.live` |

Leave `AUTH_GATEWAY_SECRET` and `AUTH_GOOGLE_CALLBACK_URL` unset to use the
deployment's own callback instead (then register
`<CONVEX_SITE_URL>/oauth/google/callback` with Google).

Local worktrees copy everything except `SITE_URL` from cloud dev
(docs/local-dev.md). Branch previews start from the project's preview
defaults, which are cloud dev's settings plus a signing key pair just for
previews (`scripts/preview-defaults.sh`). Each preview's `SITE_URL` is
`https://<branch>.preview.sportsball.live` (docs/deploy.md).

### Signing keys

`AUTH_PRIVATE_KEY` is a base64-encoded PKCS#8 PEM and `AUTH_JWKS` the matching
public JWKS. Generate a pair for a deployment with:

```sh
node -e '
const {generateKeyPairSync, randomUUID} = require("crypto");
const {publicKey, privateKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
const jwk = publicKey.export({format: "jwk"});
require("fs").writeFileSync("auth-private-key", Buffer.from(privateKey.export({type: "pkcs8", format: "pem"})).toString("base64"));
require("fs").writeFileSync("auth-jwks", JSON.stringify({keys: [{kty: jwk.kty, n: jwk.n, e: jwk.e, kid: randomUUID(), alg: "RS256", use: "sig"}]}));
'
npx convex env set --prod AUTH_PRIVATE_KEY < auth-private-key
npx convex env set --prod AUTH_JWKS < auth-jwks
/bin/rm auth-private-key auth-jwks
```

A new key pair signs everyone out of that deployment.

### Gateways

From `workers/gateway`:

```sh
pnpm install
pnpm test && pnpm check
pnpm wrangler secret put ROUTING_SECRET -c wrangler.jsonc --env dev
pnpm deploy:dev
pnpm wrangler secret put ROUTING_SECRET -c wrangler.jsonc --env prod
pnpm deploy:prod
```

Each deploy creates its custom domain (`gateway-dev.sportsball.live`,
`gateway.sportsball.live`) on the `sportsball.live` zone. The prod gateway
only forwards to `https://harmless-coyote-806.convex.site`; the dev gateway
accepts any `*.convex.site` and loopback (`http://127.0.0.1:*`,
`http://localhost:*`), since the browser follows the redirect.
`https://<gateway>/` answers "Sportsball sign-in gateway." when it's up.

## Google Cloud Console

Both clients live in the existing Google Cloud project. For each client:
**Google Auth Platform → Clients → (client) → Authorized redirect URIs**, add
the tier's gateway callback above and **Save**. Remove the old Better Auth
URIs (`…/api/auth/callback/google`) once prod runs on Convex Auth.
