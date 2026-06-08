# Market Server dev helper
# Usage:
#   .\dev.ps1          — install deps, start containers, wait for healthy, verify API
#   .\dev.ps1 down     — stop and remove containers
#   .\dev.ps1 logs     — tail container logs
#   .\dev.ps1 status   — show container status

param([string]$Action = "up")

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $scriptDir
try {
    switch ($Action) {
        "up" {
            # 1. npm install if needed
            if (-not (Test-Path "node_modules")) {
                Write-Host "[1/4] Installing npm dependencies..." -ForegroundColor Cyan
                npm install
                if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
            } else {
                Write-Host "[1/4] node_modules exists, skipping npm install" -ForegroundColor DarkGray
            }

            # 2. Start containers
            Write-Host "[2/4] Starting Docker containers..." -ForegroundColor Cyan
            docker compose up -d --build
            if ($LASTEXITCODE -ne 0) { throw "docker compose up failed" }

            # 3. Wait for API to be healthy
            Write-Host "[3/4] Waiting for API server (http://localhost:3100/health)..." -ForegroundColor Cyan
            $maxAttempts = 30
            $attempt = 0
            $ready = $false
            while ($attempt -lt $maxAttempts) {
                $attempt++
                try {
                    $resp = Invoke-RestMethod -Uri "http://localhost:3100/health" -TimeoutSec 2 -ErrorAction Stop
                    if ($resp.status -eq "ok") {
                        $ready = $true
                        break
                    }
                } catch {
                    # not ready yet
                }
                Start-Sleep -Seconds 2
            }

            if (-not $ready) {
                Write-Host "API server did not become healthy after $($maxAttempts * 2)s" -ForegroundColor Red
                docker compose logs api --tail 20
                throw "API health check failed"
            }

            # 4. Verify endpoints
            Write-Host "[4/4] Verifying API endpoints..." -ForegroundColor Cyan
            $skills = Invoke-RestMethod -Uri "http://localhost:3100/api/skills" -ErrorAction Stop
            Write-Host "  GET /api/skills -> $($skills.Count) skills" -ForegroundColor Green

            Write-Host ""
            Write-Host "Market server ready at http://localhost:3100" -ForegroundColor Green
            Write-Host "Run 'npm run tauri dev' in the project root to start Felina." -ForegroundColor DarkGray
        }

        "down" {
            Write-Host "Stopping containers..." -ForegroundColor Yellow
            docker compose down
        }

        "logs" {
            docker compose logs -f --tail 50
        }

        "status" {
            docker compose ps
        }

        default {
            Write-Host "Unknown action: $Action" -ForegroundColor Red
            Write-Host "Usage: .\dev.ps1 [up|down|logs|status]"
        }
    }
} finally {
    Pop-Location
}
