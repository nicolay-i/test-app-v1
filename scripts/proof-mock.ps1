$ErrorActionPreference = 'Stop'

$base = @('bench', 'run-one', '--task', 'todomvc', '--model', 'deepseek-v4-flash-free', '--system', 'S2-maintainable-simple', '--user', 'U5-maintainable', '--edit', 'E2-smallest-maintainable-change', '--run-type', 'mock')

function Get-ExecutionId([string]$Output) {
  $match = [regex]::Match($Output, '(?m)^execution:\s+([^\s]+)')
  if (!$match.Success) { throw 'Command did not print an execution id.' }
  return $match.Groups[1].Value
}

function Invoke-CapturedPnpm([string[]]$Arguments) {
  $previousPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = (& pnpm @Arguments 2>&1 | Out-String)
    return [pscustomobject]@{ Output = $output; ExitCode = $LASTEXITCODE }
  } finally {
    $ErrorActionPreference = $previousPreference
  }
}

function Invoke-RunAndVerify([int]$Run, [string[]]$Arguments) {
  $result = Invoke-CapturedPnpm ($base + @('--run', $Run) + $Arguments)
  if ($result.ExitCode -ne 0) { throw "Run $Run unexpectedly failed.`n$($result.Output)" }
  $execution = Get-ExecutionId $result.Output
  & pnpm bench verify-run --execution $execution | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "verify-run failed for $execution." }
  return $execution
}

function Assert-RunFailsAndVerify([int]$Run, [string[]]$Arguments) {
  $result = Invoke-CapturedPnpm ($base + @('--run', $Run) + $Arguments)
  if ($result.ExitCode -eq 0) { throw "Expected benchmark failure did not occur for run $Run.`n$($result.Output)" }
  $execution = Get-ExecutionId $result.Output
  & pnpm bench verify-run --execution $execution | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "verify-run failed for $execution." }
  return $execution
}

pnpm typecheck
if ($LASTEXITCODE -ne 0) { throw 'typecheck failed.' }
& pnpm bench validate-task tasks/todomvc
if ($LASTEXITCODE -ne 0) { throw 'task validation failed.' }
& pnpm bench verify-opencode-parser
if ($LASTEXITCODE -ne 0) { throw 'parser verification failed.' }
& pnpm bench verify-opencode-retry
if ($LASTEXITCODE -ne 0) { throw 'retry verification failed.' }
& pnpm bench verify-lifecycle-preflight
if ($LASTEXITCODE -ne 0) { throw 'preflight verification failed.' }

$happyExecution = Invoke-RunAndVerify 701 @('--versions', '4', '--mock-profile', 'happy')
$failureExecution = Assert-RunFailsAndVerify 702 @('--versions', '0', '--mock-profile', 'opencode-fail-v0')
$laterFailureExecution = Assert-RunFailsAndVerify 708 @('--versions', '2', '--mock-profile', 'opencode-fail-v2')
$timeoutExecution = Assert-RunFailsAndVerify 703 @('--versions', '0', '--mock-profile', 'timeout-v0')
$repairExecution = Invoke-RunAndVerify 704 @('--versions', '2', '--mock-profile', 'build-fail-v2-repair-success')
$repairFailureExecution = Assert-RunFailsAndVerify 705 @('--versions', '2', '--mock-profile', 'e2e-fail-v2-repair-fail')
$malformedExecution = Invoke-RunAndVerify 706 @('--versions', '0', '--mock-profile', 'malformed-events')
$isolationLeft = Invoke-RunAndVerify 710 @('--versions', '0', '--mock-profile', 'happy')
$isolationRight = Invoke-RunAndVerify 710 @('--versions', '0', '--mock-profile', 'malformed-events')
$env:APE_REUSE_SCAFFOLD_NODE_MODULES = 'true'
$manualExecution = Invoke-RunAndVerify 711 @('--versions', '2', '--mock-profile', 'happy', '--skip-install', '--no-repair', '--interventions', 'proof/manual-interventions.fixture.jsonl')

$leftWorkspace = Get-ChildItem "runs/ape_mvp_001/executions/$isolationLeft/workspaces" -Directory | Select-Object -First 1
$rightWorkspace = Get-ChildItem "runs/ape_mvp_001/executions/$isolationRight/workspaces" -Directory | Select-Object -First 1
if (!$leftWorkspace -or !$rightWorkspace -or $leftWorkspace.FullName -eq $rightWorkspace.FullName) { throw 'Fresh same-cell executions reused a workspace.' }

$manualSummary = Get-ChildItem "runs/ape_mvp_001/executions/$manualExecution/artifacts" -Filter trajectory-summary.json -Recurse | Select-Object -First 1
if (!$manualSummary) { throw 'Manual-intervention trajectory summary was not written.' }
$humanActivity = (Get-Content -Raw $manualSummary.FullName | ConvertFrom-Json).actual_human_activity
if ($humanActivity.human_prompt_corrections -ne 1 -or $humanActivity.human_acceptance_corrections -ne 1 -or $humanActivity.human_code_edits -ne 1 -or $humanActivity.manual_files_changed -ne 2 -or $humanActivity.manual_lines_added -ne 8 -or $humanActivity.manual_lines_deleted -ne 3) { throw 'Manual intervention counters are incorrect.' }
if (!(Select-String -Quiet -Path $manualSummary.FullName -Pattern 'manual-interventions\.jsonl#3')) { throw 'Manual intervention artifact links are incorrect.' }

$malformedResult = Get-ChildItem "runs/ape_mvp_001/executions/$malformedExecution/artifacts" -Filter opencode-result.json -Recurse | Select-Object -First 1
if (!$malformedResult -or !(Select-String -Quiet -Path $malformedResult.FullName -Pattern '"streamStatus": "partial"')) { throw 'Malformed event stream was not recorded as partial.' }

& pnpm bench aggregate --execution $happyExecution | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Aggregation failed.' }
if (!(Select-String -Quiet -Path "runs/ape_mvp_001/executions/$happyExecution/leaderboard.md" -Pattern 'No eligible real runs yet')) { throw 'Mock trajectory appeared in a leaderboard.' }

$repairArtifacts = Get-ChildItem "runs/ape_mvp_001/executions/$repairExecution/artifacts" -Filter repair-summaries.json -Recurse | Select-Object -First 1
if (!$repairArtifacts -or !(Select-String -Quiet -Path $repairArtifacts.FullName -Pattern '"attempt": 2')) { throw 'Repair success did not require a second repair attempt.' }
$repairFailureArtifacts = Get-ChildItem "runs/ape_mvp_001/executions/$repairFailureExecution/artifacts" -Filter repair-summaries.json -Recurse | Select-Object -First 1
if (!$repairFailureArtifacts -or !(Select-String -Quiet -Path $repairFailureArtifacts.FullName -Pattern '"attempt": 2')) { throw 'Repair failure did not stop at the configured repair limit.' }

$dryResult = Invoke-CapturedPnpm ($base + @('--run', 707, '--versions', 0, '--mock-profile', 'happy', '--dry-run'))
if ($dryResult.ExitCode -ne 0) { throw "Dry run failed.`n$($dryResult.Output)" }
$dryExecution = Get-ExecutionId $dryResult.Output
& pnpm @base '--run' 707 '--versions' 0 '--mock-profile' happy '--dry-run' '--resume' $dryExecution | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Compatible resume failed.' }
$staleResume = Invoke-CapturedPnpm ($base + @('--run', 707, '--versions', 1, '--mock-profile', 'happy', '--dry-run', '--resume', $dryExecution))
if ($staleResume.ExitCode -eq 0) { throw 'Stale resume was accepted.' }

$promptPath = 'prompts/user/U5-maintainable.md'
$taskPath = 'tasks/todomvc/task.yaml'
$promptBackup = Get-Content -Raw $promptPath
$taskBackup = Get-Content -Raw $taskPath
try {
  [System.IO.File]::AppendAllText((Resolve-Path $promptPath), "`n<!-- proof prompt mutation -->`n")
  $promptMismatch = Invoke-CapturedPnpm ($base + @('--run', 707, '--versions', 0, '--mock-profile', 'happy', '--dry-run', '--resume', $dryExecution))
  if ($promptMismatch.ExitCode -eq 0) { throw 'Prompt-hash resume mismatch was accepted.' }
  Set-Content -NoNewline -Path $promptPath -Value $promptBackup
  [System.IO.File]::AppendAllText((Resolve-Path $taskPath), "`n# proof task mutation`n")
  $taskMismatch = Invoke-CapturedPnpm ($base + @('--run', 707, '--versions', 0, '--mock-profile', 'happy', '--dry-run', '--resume', $dryExecution))
  if ($taskMismatch.ExitCode -eq 0) { throw 'Task-hash resume mismatch was accepted.' }
} finally {
  Set-Content -NoNewline -Path $promptPath -Value $promptBackup
  Set-Content -NoNewline -Path $taskPath -Value $taskBackup
}

Write-Output "mock proof passed: happy=$happyExecution failure=$failureExecution later_failure=$laterFailureExecution timeout=$timeoutExecution repair=$repairExecution repair_failure=$repairFailureExecution malformed=$malformedExecution manual=$manualExecution isolation=$isolationLeft/$isolationRight"
