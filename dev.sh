#!/usr/bin/env bash
set -euo pipefail

case "${1:-help}" in
  dev)
    npm run dev -- --config example_config.json
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
    docker compose up -d redis && docker compose up -d db
    ;;
  cserve)
    npm run coverage && cd coverage && npx http-server
    ;;
  *)
    echo "Usage: ./dev.sh <operation>"
    echo ""
    echo "Operations:"
    echo "  dev       Run dev server with example config"
    echo "  coverage  Run test suite with coverage"
    echo "  test      Run tests"
    echo "  check     Compile + coverage + lint"
    echo "  db        Start redis and db containers"
    echo "  csserve   Serve coverage report via HTTP"
    exit 1
    ;;
esac
