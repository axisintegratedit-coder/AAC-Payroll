#!/usr/bin/env bash
# Deploy the SAME codebase to one of the two Firebase projects.
#
# Usage:
#   ./deploy.sh aac        # deploy to AAC database/site
#   ./deploy.sh original   # deploy to the original database/site
#   ./deploy.sh both       # deploy to both, one after the other
#
# The database is chosen by swapping the matching .env.<target> file into
# .env.local before building. These .env.* files are gitignored and never
# leave your machine.

set -euo pipefail
cd "$(dirname "$0")"

# --- per-target configuration -------------------------------------------------
deploy_target() {
  local target="$1"
  local envfile project site account

  case "$target" in
    aac)
      envfile=".env.aac"
      project="aac-payroll-65032"
      site="aac-payroll-65032"
      account="louiserobertsegura0630@gmail.com"
      ;;
    original)
      envfile=".env.original"
      project="payroll-system-842f1"
      site="payroll-system-842f1"
      account="louiserobertsegura0630@gmail.com"
      ;;
    *)
      echo "Unknown target: $target (use: aac | original | both)" >&2
      exit 1
      ;;
  esac

  if [[ ! -f "$envfile" ]]; then
    echo "Missing $envfile — cannot deploy to '$target'." >&2
    exit 1
  fi

  echo ""
  echo "=== Deploying to '$target'  (project: $project, site: $site) ==="
  cp "$envfile" .env.local           # select the database for this build
  npm run build
  firebase deploy --only "hosting:$site" --project "$project" --account "$account"
  echo "=== Done: https://$site.web.app ==="
}
# -----------------------------------------------------------------------------

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "Usage: ./deploy.sh [aac|original|both]" >&2
  exit 1
fi

if [[ "$target" == "both" ]]; then
  deploy_target aac
  deploy_target original
else
  deploy_target "$target"
fi
