#!/usr/bin/env sh
# Deletes a branch's previews: its Worker Preview and its Convex preview
# deployment. Run by .github/workflows/preview-cleanup.yml when a pull request
# closes or a branch is deleted; either may already be gone. See docs/deploy.md.
#   usage: preview-delete.sh <branch>
# Needs CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (Workers Scripts: Edit) and
# CONVEX_MANAGEMENT_TOKEN (a Convex team access token): the same secrets as Kino.
set -eu

name="$(WORKERS_CI_BRANCH="$1" sh "$(dirname "$0")/preview-name.sh")"
[ -n "$name" ] || { echo "preview-delete: no preview name for '$1'" >&2; exit 1; }
[ "$name" != main ] || { echo "preview-delete: main has no preview" >&2; exit 1; }
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is not set}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is not set}"
: "${CONVEX_MANAGEMENT_TOKEN:?CONVEX_MANAGEMENT_TOKEN is not set}"

previews=https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/workers/sportsball/previews
convex=https://api.convex.dev/v1
convex_project=1553903 # nate-dunn/sportsball-live

# Worker Preview, by its URL name (<name>.preview.sportsball.live).
status="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$previews/$name")"
case "$status" in
200)
	# Cloudflare also deletes a branch's preview around merge time, so it can
	# vanish between the lookup and this delete
	deleted="$(curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" "$previews/$name")"
	case "$deleted" in
	2??) echo "preview-delete: deleted Worker Preview $name" ;;
	404) echo "preview-delete: Worker Preview $name was already deleted" ;;
	*) echo "preview-delete: deleting Worker Preview $name returned $deleted" >&2; exit 1 ;;
	esac ;;
404) echo "preview-delete: no Worker Preview $name" ;;
*) echo "preview-delete: looking up Worker Preview $name returned $status" >&2; exit 1 ;;
esac

# Convex preview deployment, by its preview name.
deployment="$(curl -sSf -H "Authorization: Bearer $CONVEX_MANAGEMENT_TOKEN" \
	"$convex/projects/$convex_project/list_deployments?deploymentType=preview" |
	jq -r --arg n "$name" '.[] | select(.deploymentType == "preview" and .previewIdentifier == $n) | .name')"
if [ -n "$deployment" ]; then
	deleted="$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $CONVEX_MANAGEMENT_TOKEN" "$convex/deployments/$deployment/delete")"
	case "$deleted" in
	2??) echo "preview-delete: deleted Convex preview $deployment ($name)" ;;
	404) echo "preview-delete: Convex preview $deployment ($name) was already deleted" ;;
	*) echo "preview-delete: deleting Convex preview $deployment returned $deleted" >&2; exit 1 ;;
	esac
else
	echo "preview-delete: no Convex preview $name"
fi
