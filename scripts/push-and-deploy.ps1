$ErrorActionPreference = 'Stop'

$remote = 'origin'
$branch = git branch --show-current
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  throw 'Unable to determine the current Git branch.'
}

if ($branch -ne 'main') {
  throw "GitHub Pages deploys from main. Switch to main before running this script (current branch: $branch)."
}

git push $remote $branch
if ($LASTEXITCODE -ne 0) {
  throw 'Git push failed.'
}

$sha = git rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($sha)) {
  throw 'Unable to determine the pushed commit SHA.'
}

$runId = gh run list `
  --repo nickallan-kerv/rubikscube `
  --workflow deploy-pages.yml `
  --commit $sha `
  --limit 20 `
  --json databaseId `
  --jq '.[0].databaseId'

if ($LASTEXITCODE -ne 0) {
  throw 'Unable to inspect GitHub Pages workflow runs.'
}

if ([string]::IsNullOrWhiteSpace($runId)) {
  $dispatchOutput = gh workflow run deploy-pages.yml --repo nickallan-kerv/rubikscube --ref $branch 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to dispatch GitHub Pages workflow: $($dispatchOutput -join "`n")"
  }

  $dispatchText = $dispatchOutput -join "`n"
  $runMatch = [regex]::Match($dispatchText, '/actions/runs/(\d+)')
  if (-not $runMatch.Success) {
    throw "GitHub Pages workflow dispatched, but its run ID could not be determined: $dispatchText"
  }

  $runId = $runMatch.Groups[1].Value
}

Write-Output "Watching GitHub Pages run $runId for commit $sha."
gh run watch $runId --repo nickallan-kerv/rubikscube --exit-status
if ($LASTEXITCODE -ne 0) {
  throw "GitHub Pages deployment failed for commit $sha."
}

Write-Output "GitHub Pages deployed commit $sha."