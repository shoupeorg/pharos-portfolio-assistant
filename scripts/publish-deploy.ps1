[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Project

function Run([string]$Label, [scriptblock]$Action) {
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

Run 'Install exact dependencies' { npm.cmd install --cache .npm-cache }
Run 'Behavioral tests and Worker build' { npm.cmd run check }

$GitPath = 'C:\Program Files\Git\bin;C:\Program Files\Git\mingw64\bin'
$env:PATH = "$GitPath;$env:PATH"
$SafeProject = $Project.Replace('\','/')
Run 'Publish local main to GitHub' { git -c "safe.directory=$SafeProject" push -u origin main }

Run 'Verify Cloudflare identity' { npx.cmd wrangler whoami }

Write-Host '==> Find or create the exact D1 database' -ForegroundColor Cyan
$ListText = (& npx.cmd wrangler d1 list --json 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0) { throw "D1 list failed: $ListText" }
$Start = $ListText.IndexOf('[')
$End = $ListText.LastIndexOf(']')
if ($Start -lt 0 -or $End -le $Start) { throw 'Wrangler did not return a D1 JSON array.' }
$Databases = $ListText.Substring($Start, $End - $Start + 1) | ConvertFrom-Json
$Matches = @($Databases | Where-Object { $_.name -ceq 'pharos-portfolio-assistant' })
if ($Matches.Count -eq 0) {
  Run 'Create D1 database pharos-portfolio-assistant' { npx.cmd wrangler d1 create pharos-portfolio-assistant }
  $ListText = (& npx.cmd wrangler d1 list --json 2>&1 | Out-String)
  if ($LASTEXITCODE -ne 0) { throw "D1 list after create failed: $ListText" }
  $Start = $ListText.IndexOf('['); $End = $ListText.LastIndexOf(']')
  $Databases = $ListText.Substring($Start, $End - $Start + 1) | ConvertFrom-Json
  $Matches = @($Databases | Where-Object { $_.name -ceq 'pharos-portfolio-assistant' })
}
if ($Matches.Count -ne 1) { throw "Expected exactly one D1 database named pharos-portfolio-assistant; found $($Matches.Count)." }
$DatabaseId = [string]$Matches[0].uuid
if ($DatabaseId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') { throw "D1 database ID is not one UUID." }

$ConfigPath = Join-Path $Project 'wrangler.jsonc'
$Config = Get-Content -Raw -LiteralPath $ConfigPath
$Updated = [regex]::Replace($Config, '("database_id"\s*:\s*")[^"]+("\s*)', "`$1$DatabaseId`$2", 1)
if ($Updated -eq $Config -and $Config -notmatch [regex]::Escape($DatabaseId)) { throw 'Could not update the existing D1 database_id binding.' }
[System.IO.File]::WriteAllText($ConfigPath, $Updated, [System.Text.UTF8Encoding]::new($false))

Run 'Apply D1 migrations' { npx.cmd wrangler d1 migrations apply pharos-portfolio-assistant --remote }
Run 'Deploy Worker' { npm.cmd run deploy }
Run 'Seed and verify persistent live reviewer evidence' { node.exe scripts/seed-deployed.mjs }

Write-Host 'Publication, D1 migration, deployment, and live evidence seeding completed.' -ForegroundColor Green
