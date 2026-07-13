$ErrorActionPreference = 'Stop'
$env:APE_REUSE_SCAFFOLD_NODE_MODULES = 'true'

$base = @('bench', 'run-one', '--task', 'todomvc', '--model', 'deepseek-v4-flash-free', '--system', 'S2-maintainable-simple', '--user', 'U3-semantic-ui', '--edit', 'E2-smallest-maintainable-change', '--run-type', 'mock', '--versions', '0', '--skip-install')

function Invoke-Fixture([int]$Run, [string]$Profile) {
  & pnpm @base '--run' $Run '--mock-profile' $Profile
  if ($LASTEXITCODE -ne 0) { throw "Fixture $Profile unexpectedly failed." }
}

function Assert-Fails([int]$Run, [string]$Profile) {
  & pnpm bench run-one --task todomvc --model deepseek-v4-flash-free --system S2-maintainable-simple --user U3-semantic-ui --edit E2-smallest-maintainable-change --run-type mock --versions 2 --run $Run --mock-profile $Profile --skip-install --no-repair
  if ($LASTEXITCODE -eq 0) { throw "Broken fixture $Profile unexpectedly passed." }
}

Invoke-Fixture 801 happy
Invoke-Fixture 802 alternative-dom

& pnpm @base '--run' 803 '--mock-profile' 'intentionally-broken' '--no-repair'
if ($LASTEXITCODE -eq 0) { throw 'Intentionally broken fixture unexpectedly passed.' }

Assert-Fails 804 broken-due-dates
Assert-Fails 805 broken-search
Write-Output 'fairness fixture proof passed'
