# Start Taqwin frontend + backend with auto-reload on file changes.
# Usage: .\scripts\dev.ps1   (from repo root)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Test-Path "node_modules\concurrently")) {
  Write-Host "Installing root dev dependencies..."
  npm install
}

Write-Host "Starting backend (port 4000) + frontend (port 3000) — saves reload automatically."
npm run dev
