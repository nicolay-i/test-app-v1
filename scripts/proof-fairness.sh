#!/usr/bin/env bash
set -euo pipefail

# Базовый suite содержит создание, completion, фильтры и persistence; v0 достаточно,
# чтобы отличить альтернативную реализацию от fixture с намеренно сломанным фильтром.
base=(pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --run-type mock --versions 0)

run_fixture() {
  local run="$1"
  local profile="$2"
  "${base[@]}" --run "$run" --mock-profile "$profile"
}

run_fixture 801 happy
run_fixture 802 alternative-dom

if run_fixture 803 intentionally-broken; then
  echo "intentionally broken fixture unexpectedly passed" >&2
  exit 1
fi

if pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --run-type mock --versions 2 --run 804 --mock-profile broken-due-dates; then
  echo "broken due-date fixture unexpectedly passed" >&2
  exit 1
fi

if pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --run-type mock --versions 2 --run 805 --mock-profile broken-search; then
  echo "broken search fixture unexpectedly passed" >&2
  exit 1
fi

echo "fairness fixture proof passed"
