#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

case "${1:-help}" in
  dev)
    npm run dev -- dev -c example_config.json
    ;;
  coverage)
    npm run coverage
    ;;
  test)
    npm run test
    ;;
  check)
    npm run compile && npm run coverage && npm run lint:write
    ;;
  db)
    docker compose up -d redis && docker compose up -d db && docker compose up -d mysql && docker compose up -d memcache
    ;;
  cserve)
    npm run coverage && cd coverage && npx http-server
    ;;
  e2e)
    npm run test:e2e
    ;;
  release)
    BRANCH="${2:-ross-release}"
    REMOTE_URL="$(git -C "$SCRIPT_DIR" remote get-url origin)"
    npm run clean && npm run compile

    TMP_DIR="$(mktemp -d)"
    trap 'rm -rf "$TMP_DIR"' EXIT

    mkdir -p "$TMP_DIR/build"
    cp "$SCRIPT_DIR/package.json" "$TMP_DIR/"
    cp "$SCRIPT_DIR/README.md" "$TMP_DIR/"
    cp "$SCRIPT_DIR/LICENSE" "$TMP_DIR/"
    cp -R "$SCRIPT_DIR/build/src" "$TMP_DIR/build/src"

    git -C "$TMP_DIR" init -q
    git -C "$TMP_DIR" add -A
    git -C "$TMP_DIR" commit -q -m "chore(ross): release build"
    git -C "$TMP_DIR" push -f "$REMOTE_URL" "HEAD:$BRANCH"
    echo "Pushed ross build to $BRANCH ($REMOTE_URL)"
    ;;
  *)
    echo "Usage: ./dev.sh <operation>"
    echo ""
    echo "Operations:"
    echo "  dev       Run dev server with example config"
    echo "  coverage  Run test suite with coverage"
    echo "  test      Run tests"
    echo "  check     Compile + coverage + lint"
    echo "  e2e       Run Playwright E2E API tests"
    echo "  db        Start redis and db containers"
    echo "  csserve   Serve coverage report via HTTP"
    echo "  release   Build ross and force-push to release branch (default: ross-release)"
    exit 1
    ;;
esac
