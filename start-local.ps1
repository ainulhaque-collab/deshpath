$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$taskNode = Get-Command node -ErrorAction SilentlyContinue
if ($taskNode) {
  & $taskNode.Source (Join-Path $PSScriptRoot 'server.mjs')
} else {
  $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
  if (Test-Path -LiteralPath $bundledNode) {
    & $bundledNode (Join-Path $PSScriptRoot 'server.mjs')
  } else {
    Write-Host 'Node.js 18 or newer is required: https://nodejs.org/'
    Read-Host 'Press Enter to close'
  }
}
