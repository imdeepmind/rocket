#!/usr/bin/env bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE e2e_testing'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'e2e_testing')\gexec
EOSQL

