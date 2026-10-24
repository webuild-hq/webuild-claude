#!/usr/bin/env bash
# Applique les migrations sur une base Postgres locale jetable, puis lance les tests SQL.
# Usage : scripts/test-db.sh   (nécessite psql et un Postgres local accessible en superutilisateur)
set -euo pipefail
cd "$(dirname "$0")/.."

PSQL=${PSQL:-psql}
DB=webuild_test_$$

$PSQL -q -c "create database $DB" postgres
trap '$PSQL -q -c "drop database if exists $DB" postgres' EXIT

cat supabase/tests/supabase-stub.sql supabase/migrations/*.sql | $PSQL -q -v ON_ERROR_STOP=1 -d "$DB"
for test in supabase/tests/*.test.sql; do
  echo "### $test"
  $PSQL -q -d "$DB" -f "$test"
done
