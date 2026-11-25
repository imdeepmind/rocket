#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT="${1:-}"
if [[ -z "$PROJECT" ]]; then
  echo "Usage: ./dev.sh <project> <operation> [args...]"
  echo ""
  echo "Projects:"
  echo "  ross             ROSS API framework (ross/)"
  echo "  ross-docs        ROSS documentation site (ross/docs/)"
  echo "  rocket-platform  Rocket platform web app (rocket/platform/)"
  exit 1
fi

shift

case "$PROJECT" in
  ross)
    exec bash "$ROOT_DIR/ross/dev.sh" "$@"
    ;;
  ross-docs)
    exec bash "$ROOT_DIR/ross/docs/dev.sh" "$@"
    ;;
  rocket-platform)
    exec bash "$ROOT_DIR/rocket/platform/dev.sh" "$@"
    ;;
  *)
    echo "Unknown project: $PROJECT"
    echo ""
    echo "Available projects: ross, ross-docs, rocket-platform"
    exit 1
    ;;
esac
