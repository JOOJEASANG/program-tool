#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIF_PROVIDER_VALUE="${WIF_PROVIDER:-${GCP_WORKLOAD_IDENTITY_PROVIDER:-}}"
WIF_SERVICE_ACCOUNT_VALUE="${WIF_SERVICE_ACCOUNT:-${GCP_SERVICE_ACCOUNT:-}}"

prepare_hosting_if_needed() {
  case "${1:-}" in
    deploy|hosting:channel:deploy)
      python3 "$ROOT_DIR/scripts/validate_hosting_delivery.py"
      ;;
  esac
}

if [[ -n "$WIF_PROVIDER_VALUE" && -z "$WIF_SERVICE_ACCOUNT_VALUE" ]] || \
   [[ -z "$WIF_PROVIDER_VALUE" && -n "$WIF_SERVICE_ACCOUNT_VALUE" ]]; then
  echo "Firebase CI WIF configuration is incomplete. Configure both provider and service account secrets." >&2
  exit 2
fi

if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  # Firebase CLI must use the short-lived ADC credential created by
  # google-github-actions/auth. Never allow an inherited legacy refresh token
  # to override ADC implicitly.
  unset FIREBASE_TOKEN
  prepare_hosting_if_needed "$@"
  exec firebase "$@"
fi

if [[ -n "$WIF_PROVIDER_VALUE" && -n "$WIF_SERVICE_ACCOUNT_VALUE" ]]; then
  echo "WIF secrets are configured but ADC credentials are unavailable. Run the WIF authentication step before Firebase CLI." >&2
  exit 2
fi

echo "Firebase CI authentication is unavailable. Workload Identity Federation is required." >&2
exit 2
