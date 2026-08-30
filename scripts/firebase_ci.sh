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
  # Prefer short-lived ADC/WIF credentials. A legacy refresh token in the
  # environment must not override ADC after google-github-actions/auth succeeds.
  unset FIREBASE_TOKEN
  prepare_hosting_if_needed "$@"
  exec firebase "$@"
fi

if [[ -n "$WIF_PROVIDER_VALUE" && -n "$WIF_SERVICE_ACCOUNT_VALUE" ]]; then
  echo "WIF secrets are configured but ADC credentials are unavailable. Refusing legacy token fallback." >&2
  exit 2
fi

if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
  echo "::warning::Using legacy FIREBASE_TOKEN fallback. Configure WIF secrets to move CI to short-lived ADC credentials." >&2
  prepare_hosting_if_needed "$@"
  exec firebase "$@" --token "$FIREBASE_TOKEN"
fi

echo "Firebase CI authentication is unavailable. Configure Workload Identity Federation or FIREBASE_TOKEN." >&2
exit 2
