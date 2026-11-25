#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

case "${1:-help}" in
  dev)
    npm run dev
    ;;
  build)
    npm run build
    ;;
  start)
    npm run start
    ;;
  lint)
    npm run lint && npm run prettier
    ;;
  lint:fix)
    npm run prettier:write
    ;;
  check)
    npm run lint && npm run prettier && npm run build
    ;;
  storybook)
    npm run storybook
    ;;
  build-storybook)
    npm run build-storybook
    ;;
  *)
    echo "Usage: ./dev.sh <operation>"
    echo ""
    echo "Operations:"
    echo "  dev              Start Next.js dev server"
    echo "  build            Build Next.js production bundle"
    echo "  start            Start Next.js production server"
    echo "  lint             Run ESLint and Prettier check"
    echo "  lint:fix         Format files with Prettier"
    echo "  check            Lint + Prettier check + build"
    echo "  storybook        Start Storybook dev server"
    echo "  build-storybook  Build Storybook static site"
    exit 1
    ;;
esac

