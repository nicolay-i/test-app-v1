#!/usr/bin/env bash
set -euo pipefail

base=(pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U5-maintainable --edit E2-smallest-maintainable-change --run-type mock)

extract_execution() {
  sed -n 's/^execution: \([^ ]*\).*/\1/p' <<<"$1"
}

run_and_verify() {
  local run="$1"
  shift
  local output execution
  output=$("${base[@]}" --run "$run" "$@")
  execution=$(extract_execution "$output")
  test -n "$execution"
  pnpm bench verify-run --execution "$execution" >/dev/null
  printf '%s\n' "$execution"
}

expect_failure_and_verify() {
  local run="$1"
  shift
  local output execution
  if output=$("${base[@]}" --run "$run" "$@" 2>&1); then
    printf '%s\n' "$output"
    echo "expected benchmark failure did not occur" >&2
    exit 1
  fi
  execution=$(extract_execution "$output")
  test -n "$execution"
  pnpm bench verify-run --execution "$execution" >/dev/null
  printf '%s\n' "$execution"
}

pnpm typecheck
pnpm bench validate-task tasks/todomvc
pnpm bench verify-opencode-parser
pnpm bench verify-opencode-retry
pnpm bench verify-lifecycle-preflight

happy_execution=$(run_and_verify 701 --versions 4 --mock-profile happy | tail -1)
failure_execution=$(expect_failure_and_verify 702 --versions 0 --mock-profile opencode-fail-v0 | tail -1)
later_failure_execution=$(expect_failure_and_verify 708 --versions 2 --mock-profile opencode-fail-v2 | tail -1)
timeout_execution=$(expect_failure_and_verify 703 --versions 0 --mock-profile timeout-v0 | tail -1)
repair_execution=$(run_and_verify 704 --versions 2 --mock-profile build-fail-v2-repair-success | tail -1)
repair_failure_execution=$(expect_failure_and_verify 705 --versions 2 --mock-profile e2e-fail-v2-repair-fail | tail -1)
malformed_execution=$(run_and_verify 706 --versions 0 --mock-profile malformed-events | tail -1)
isolation_left=$(run_and_verify 710 --versions 0 --mock-profile happy | tail -1)
isolation_right=$(run_and_verify 710 --versions 0 --mock-profile malformed-events | tail -1)

left_workspace=$(find "runs/ape_mvp_001/executions/${isolation_left}/workspaces" -mindepth 1 -maxdepth 1 -type d | head -1)
right_workspace=$(find "runs/ape_mvp_001/executions/${isolation_right}/workspaces" -mindepth 1 -maxdepth 1 -type d | head -1)
if [[ "$left_workspace" == "$right_workspace" ]]; then
  echo "fresh same-cell executions reused a workspace" >&2
  exit 1
fi

if ! rg -q '"streamStatus": "partial"' "runs/ape_mvp_001/executions/${malformed_execution}"/artifacts/*/v0/opencode-result.json; then
  echo "malformed event stream was not recorded as partial" >&2
  exit 1
fi

pnpm bench aggregate --execution "$happy_execution" >/dev/null
if ! rg -q 'No eligible real runs yet' "runs/ape_mvp_001/executions/${happy_execution}/leaderboard.md"; then
  echo "mock trajectory appeared in a leaderboard" >&2
  exit 1
fi

repair_artifacts=$(find "runs/ape_mvp_001/executions/${repair_execution}/artifacts" -path '*/v2/repair-summaries.json' -print -quit)
if [[ -z "$repair_artifacts" ]] || ! rg -q '"attempt": 2' "$repair_artifacts"; then
  echo "repair success did not require a second repair attempt" >&2
  exit 1
fi
repair_failure_artifacts=$(find "runs/ape_mvp_001/executions/${repair_failure_execution}/artifacts" -path '*/v2/repair-summaries.json' -print -quit)
if [[ -z "$repair_failure_artifacts" ]] || ! rg -q '"attempt": 2' "$repair_failure_artifacts"; then
  echo "repair failure did not stop at the configured repair limit" >&2
  exit 1
fi

dry_output=$("${base[@]}" --run 707 --versions 0 --mock-profile happy --dry-run)
dry_execution=$(extract_execution "$dry_output")
"${base[@]}" --run 707 --versions 0 --mock-profile happy --dry-run --resume "$dry_execution" >/dev/null
if "${base[@]}" --run 707 --versions 1 --mock-profile happy --dry-run --resume "$dry_execution" >/dev/null 2>&1; then
  echo "stale resume was accepted" >&2
  exit 1
fi

backup_dir=$(mktemp -d)
prompt_path="prompts/user/U5-maintainable.md"
task_path="tasks/todomvc/task.yaml"
cp "$prompt_path" "$backup_dir/prompt"
cp "$task_path" "$backup_dir/task"
restore_hash_inputs() {
  cp "$backup_dir/prompt" "$prompt_path"
  cp "$backup_dir/task" "$task_path"
  rm -rf "$backup_dir"
}
trap restore_hash_inputs EXIT
printf '\n<!-- proof prompt mutation -->\n' >> "$prompt_path"
if "${base[@]}" --run 707 --versions 0 --mock-profile happy --dry-run --resume "$dry_execution" >/dev/null 2>&1; then
  echo "prompt-hash resume mismatch was accepted" >&2
  exit 1
fi
cp "$backup_dir/prompt" "$prompt_path"
printf '\n# proof task mutation\n' >> "$task_path"
if "${base[@]}" --run 707 --versions 0 --mock-profile happy --dry-run --resume "$dry_execution" >/dev/null 2>&1; then
  echo "task-hash resume mismatch was accepted" >&2
  exit 1
fi
restore_hash_inputs
trap - EXIT

printf 'mock proof passed: happy=%s failure=%s later_failure=%s timeout=%s repair=%s repair_failure=%s malformed=%s isolation=%s/%s\n' \
  "$happy_execution" "$failure_execution" "$later_failure_execution" "$timeout_execution" "$repair_execution" "$repair_failure_execution" "$malformed_execution" "$isolation_left" "$isolation_right"
