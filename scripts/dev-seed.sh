#!/usr/bin/env sh
# Run by scripts/dev.sh once the local backend is up. A new backend gets the
# dev settings (Google OAuth client, dev gateway, signing keys, ESPN endpoints)
# and the league data copied from cloud dev, brilliant-wren-578; every run sets
# SITE_URL to this checkout's URL, the one origin sign-in may return to. Until
# the settings are in, Convex holds the first push and retries it by itself.
#   usage: dev-seed.sh <cloud port> <app url>
set -eu
cloud="$1"
url="$2"
source_deployment=brilliant-wren-578

i=0
until curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$cloud/version"; do
	i=$((i + 1))
	[ "$i" -lt 60 ] || { echo "dev-seed: backend on :$cloud never came up" >&2; exit 1; }
	sleep 1
done

umask 077
dir="$(mktemp -d)"
trap '/bin/rm -rf "$dir"' EXIT

# `env get` rather than `env list`: the CLI lists names only when it detects an agent.
if [ -z "$(npx convex env get AUTH_JWKS 2>/dev/null)" ]; then
	npx convex env list --include-values --deployment "$source_deployment" | grep -vE '^(SITE_URL|VITE_CONVEX_URL|VITE_CONVEX_SITE_URL|BETTER_AUTH_SECRET|CONVEX_ZEN_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET)=' > "$dir/env"
	npx convex env set --from-file "$dir/env" > /dev/null
	echo "dev-seed: copied dev settings from $source_deployment"
fi

# League data only: no users, favorites, auth tables or cached images. Once per
# backend; delete .convex/local to start over.
marker=.convex/local/league-data-seeded
if [ ! -f "$marker" ]; then
	echo "dev-seed: importing league data from $source_deployment (about 10 MB)"
	npx convex export --deployment "$source_deployment" --path "$dir/snapshot.zip" > /dev/null
	tables="seasons bootstrapStatus"
	for league in nba wnba gleague; do
		for kind in Team Player GameEvent TeamEvent PlayerEvent; do
			tables="$tables $league$kind"
		done
	done
	# Every app table comes along so the snapshot's table numbers (which its
	# ids encode) stay consistent, but only league tables keep their rows.
	mkdir "$dir/league"
	unzip -q "$dir/snapshot.zip" -x '_components/*' -d "$dir/league"
	for documents in "$dir"/league/*/documents.jsonl; do
		table="$(basename "$(dirname "$documents")")"
		case " _tables $tables " in
			*" $table "*) ;;
			*) : > "$documents" ;;
		esac
	done
	(cd "$dir/league" && zip -qr ../league.zip .)
	npx convex import --replace-all -y "$dir/league.zip" > /dev/null
	touch "$marker"
	echo "dev-seed: imported league data"
fi

if [ "$(npx convex env get SITE_URL 2>/dev/null)" != "$url" ]; then
	npx convex env set SITE_URL "$url" > /dev/null
	echo "dev-seed: SITE_URL=$url"
fi
