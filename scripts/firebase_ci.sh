#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
  # Prefer short-lived ADC/WIF credentials. A legacy refresh token in the
  # environment must not override ADC after google-github-actions/auth succeeds.
  unset FIREBASE_TOKEN
  exec firebase "$@"
fi

if [[ -n "${FIREBASE_TOKEN:-}" ]]; then
  echo "::warning::Using legacy FIREBASE_TOKEN fallback. Configure WIF secrets to move CI to short-lived ADC credentials." >&2
  exec firebase "$@" --token "$FIREBASE_TOKEN"
fi

echo "Firebase CI authentication is unavailable. Configure Workload Identity Federation or FIREBASE_TOKEN." >&2
exit 2
