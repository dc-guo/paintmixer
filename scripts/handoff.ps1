# PaintBridge handoff / orientation script.
# Read-only: verifies project state for a new session. Run from the repo root:
#   pwsh scripts/handoff.ps1     (or)     powershell -File scripts\handoff.ps1

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Section($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }

Write-Host "PaintBridge handoff check" -ForegroundColor Green
Write-Host "Read temp/plans/HANDOFF.md first, then CODEX_CONTEXT.md and PHASE_2_COLOR_TOOLS.md."

Section "Git"
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Branch: $branch"
$dirty = git status --porcelain
if ($dirty) { Write-Host "Working tree: DIRTY (uncommitted changes)" -ForegroundColor Yellow }
else { Write-Host "Working tree: clean" -ForegroundColor Green }
git fetch origin --quiet 2>$null
$ahead = (git rev-list --count origin/$branch..$branch 2>$null)
$behind = (git rev-list --count $branch..origin/$branch 2>$null)
Write-Host "vs origin/${branch}: $ahead ahead, $behind behind"
Write-Host "Recent commits:"
git log --oneline -6 | ForEach-Object { Write-Host "  $_" }

Section "Milestone status (from HANDOFF.md)"
Write-Host "  2.1 full 72-color library ....... shipped (PR #2)"
Write-Host "  2.2 Kubelka-Munk mixing ......... on working, UAT-approved"
Write-Host "  2.3 recipe alternates + tweaking  on working, UAT-approved"
Write-Host "  2.4 extraction upgrades ......... NEXT" -ForegroundColor Yellow
Write-Host "  2.5 palette housekeeping ........ pending"
Write-Host "  then: high-effort review -> one phase PR -> merge deploys"

Section "Dependencies"
if (Test-Path node_modules) { Write-Host "node_modules present" -ForegroundColor Green }
else { Write-Host "node_modules MISSING - run: npm install" -ForegroundColor Yellow }

Section "Tests (npm test: tsc + node --test)"
npm test 2>&1 | Select-Object -Last 9

Section "Live site"
try {
  $code = (Invoke-WebRequest -Uri "https://dc-guo.github.io/paintmixer/" -Method Head -TimeoutSec 10 -UseBasicParsing).StatusCode
  Write-Host "https://dc-guo.github.io/paintmixer/ -> HTTP $code" -ForegroundColor Green
} catch { Write-Host "Live site check failed (offline?): $($_.Exception.Message)" -ForegroundColor Yellow }

Section "Pick up here"
Write-Host "Start milestone 2.4 per PHASE_2_COLOR_TOOLS.md:"
Write-Host "  - palette-size control (3-8, default 5, persisted)"
Write-Host "  - deterministic k-means in Lab, seeded from current bin picks"
Write-Host "  - keep markers/positions working (tests exist), then UAT handoff"
Write-Host "`nReminders: no PR per milestone (batch on working); STOP for UAT after each"
Write-Host "milestone commit; gh CLI not installed (use GitHub REST API + git credential)."
Write-Host "Dev server: preview tool 'paintbridge-dev', or npm run dev (port 5173)."
