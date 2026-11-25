#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

case "${1:-help}" in
  dev)
    npm run start
    ;;
  build)
    npm run build
    ;;
  serve)
    npm run serve
    ;;
  typecheck)
    npm run typecheck
    ;;
  lint)
    npm run lint:md
    ;;
  check)
    npm run lint:md && npm run typecheck && npm run build
    ;;
  clear)
    npm run clear
    ;;
  *)
    echo "Usage: ./dev.sh <operation>"
    echo ""
    echo "Operations:"
    echo "  dev        Start Docusaurus dev server"
    echo "  build      Build documentation site"
    echo "  serve      Serve built documentation site"
    echo "  typecheck  Run TypeScript typecheck"
    echo "  lint       Run markdown lint"
    echo "  check      Markdown lint + typecheck + build"
    echo "  clear      Clear Docusaurus cache"
    exit 1
    ;;
esac

