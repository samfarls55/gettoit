[CmdletBinding()]
param(
  [string]$Ref = "main",
  [string]$WorkflowRef = "main",
  [switch]$BuildOnly,
  [string]$ReleaseNotes = "",
  [switch]$Yes,
  [switch]$Watch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "$Name is required. Install it and retry."
  }
}

Require-Command git
Require-Command gh

$repoRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
if (-not $repoRoot) {
  Fail "Not inside a git repository."
}

Set-Location $repoRoot

$workflowPath = Join-Path $repoRoot ".github\workflows\testflight.yml"
if (-not (Test-Path $workflowPath)) {
  Fail "Missing .github\workflows\testflight.yml."
}

& gh auth status 1>$null
if ($LASTEXITCODE -ne 0) {
  Fail "GitHub CLI is not authenticated. Run gh auth login and retry."
}

$submit = -not $BuildOnly.IsPresent
$submitInput = $submit.ToString().ToLowerInvariant()
$notesMode = if ([string]::IsNullOrWhiteSpace($ReleaseNotes)) { "workflow default" } else { "provided" }

$dirty = & git status --porcelain
if ($dirty) {
  Write-Warning "Working tree has uncommitted changes. This ships GitHub ref '$Ref'; local edits are not included."
}

Write-Host "TestFlight shipment plan"
Write-Host "  git_ref:       $Ref"
Write-Host "  workflow_ref:  $WorkflowRef"
Write-Host "  EAS profile:   production"
Write-Host "  submit:        $submitInput"
Write-Host "  release notes: $notesMode"
Write-Host "  environment:   testflight"

if (-not $Yes) {
  $answer = Read-Host "Type SHIP to dispatch"
  if ($answer -cne "SHIP") {
    Write-Host "Cancelled."
    exit 1
  }
}

$ghArgs = @(
  "workflow", "run", "testflight.yml",
  "--ref", $WorkflowRef,
  "-f", "git_ref=$Ref",
  "-f", "submit=$submitInput",
  "-f", "release_notes=$ReleaseNotes"
)

& gh @ghArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Start-Sleep -Seconds 2
$runJson = & gh run list --workflow testflight.yml --limit 1 --json databaseId,status,conclusion,headBranch,createdAt,url
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($runJson)) {
  Write-Host "Dispatched. Run list not available yet; check the GitHub Actions tab."
  exit 0
}

$runs = @($runJson | ConvertFrom-Json)
if ($runs.Count -eq 0) {
  Write-Host "Dispatched. Run list is empty; check the GitHub Actions tab."
  exit 0
}

$run = $runs[0]
Write-Host "Dispatched TestFlight workflow."
Write-Host "  run id: $($run.databaseId)"
Write-Host "  status: $($run.status)"
Write-Host "  url:    $($run.url)"

if ($Watch) {
  & gh run watch $run.databaseId
}
