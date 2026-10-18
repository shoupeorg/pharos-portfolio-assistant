$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project

if (Test-Path -LiteralPath "C:\Program Files\Git\bin") {
  $env:PATH = "C:\Program Files\Git\bin;C:\Program Files\Git\cmd;$env:PATH"
}

Write-Host "==> Verify commit and tests"
git -c "safe.directory=*" status --short
npm.cmd test
if ($LASTEXITCODE -ne 0) { throw "Tests failed." }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Build failed." }

Write-Host "==> Publish existing correctness commit"
git -c "safe.directory=*" push origin main
if ($LASTEXITCODE -ne 0) { throw "Git push failed." }

Write-Host "==> Deploy existing Worker (no migration, no transaction)"
npx.cmd wrangler deploy --no-bundle
if ($LASTEXITCODE -ne 0) { throw "Worker deployment failed." }

Write-Host "==> Persist and verify corrected engine-v2 live evidence"
node.exe scripts/seed-deployed.mjs
if ($LASTEXITCODE -ne 0) { throw "Deployed evidence verification failed." }

Write-Host "Correctness patch publication and deployment completed."
