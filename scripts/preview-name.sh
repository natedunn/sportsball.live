#!/usr/bin/env sh
# The branch as one DNS label: lowercase, [a-z0-9-], at most 40 characters.
# Names both the Convex preview and the Worker Preview
# (<name>.preview.sportsball.live).
set -eu
branch="${WORKERS_CI_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
printf '%s' "$branch" | tr '[:upper:]' '[:lower:]' |
	sed 's/[^a-z0-9-]/-/g; s/--*/-/g; s/^-//' | cut -c 1-40 | sed 's/-$//'
