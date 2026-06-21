<#
.SYNOPSIS
    One-command setup for TextGenHub.
.DESCRIPTION
    Installs all dependencies (Python packages, Node.js packages, Ollama)
    and guides you through API key configuration.
    Run from PowerShell in the project root.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "  [SKIP] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "      $msg" -ForegroundColor Gray }

# ── Detect if running as admin (needed for Ollama installer) ──
function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# ── 1. Check Python ──
Write-Step "Checking Python"
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyVersion = python --version 2>&1
    Write-Ok "Python found: $pyVersion"
} else {
    Write-Err "Python not found."
    Write-Info "Download from https://www.python.org/downloads/"
    exit 1
}

# ── 2. Check Poetry ──
Write-Step "Checking Poetry"
if (Get-Command poetry -ErrorAction SilentlyContinue) {
    Write-Ok "Poetry found"
} else {
    Write-Info "Poetry not found. Installing..."
    powershell -Command "irm https://install.python-poetry.org | python -"
    # Add Poetry to PATH (current session)
    $poetryHome = "$env:USERPROFILE\.local\bin"
    if (-not $env:PATH.Split(';').Contains($poetryHome)) {
        $env:PATH = "$poetryHome;$env:PATH"
    }
    if (Get-Command poetry -ErrorAction SilentlyContinue) {
        Write-Ok "Poetry installed"
    } else {
        Write-Err "Poetry install failed. Run the command again."
        exit 1
    }
}

# ── 3. Check Node.js ──
Write-Step "Checking Node.js"
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    Write-Ok "Node.js found: $nodeVersion"
} else {
    Write-Err "Node.js not found."
    Write-Info "Required for web UI providers (ChatGPT, DeepSeek browser, etc.)"
    Write-Info "Download from https://nodejs.org/"
    $install = Read-Host "Install Node.js via winget? (y/N)"
    if ($install -eq "y") {
        Write-Info "Installing Node.js LTS (this may open a UAC prompt)..."
        winget install OpenJS.NodeJS.LTS --accept-source-agreement --accept-package-agreements
        Write-Ok "Node.js installed. Close and reopen this terminal, then run setup again."
        exit 0
    }
    exit 1
}

# ── 4. Install Python dependencies ──
Write-Step "Installing Python dependencies"
poetry install
Write-Ok "Python dependencies installed"

# ── 5. Install Node.js dependencies ──
Write-Step "Installing Node.js dependencies"
Push-Location src\textgenhub
npm install
Pop-Location
Write-Ok "Node.js dependencies installed"

# ── 6. Install Ollama (optional) ──
Write-Step "Installing Ollama (optional, for local models)"
$ollama = Read-Host "Install Ollama? (y/N)"
if ($ollama -eq "y") {
    if (Get-Command ollama -ErrorAction SilentlyContinue) {
        $ollamaVersion = ollama --version
        Write-Ok "Ollama already installed: $ollamaVersion"
    } else {
        $isAdmin = Test-Admin
        if (-not $isAdmin) {
            Write-Info "Admin rights needed for Ollama installer. Relaunching as admin..."
            $scriptPath = $MyInvocation.MyCommand.Path
            $argsList = $args -join " "
            Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`"", $argsList
            exit 0
        }
        Write-Info "Downloading Ollama installer..."
        $installer = "$env:TEMP\OllamaSetup.exe"
        Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installer -UseBasicParsing
        Write-Info "Installing Ollama (this may take a few minutes)..."
        Start-Process -FilePath $installer -ArgumentList "/S" -Wait
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
        Write-Ok "Ollama installed"
    }

    # Pull a default model
    $pull = Read-Host "Pull a default model (llama3)? (y/N)"
    if ($pull -eq "y") {
        Write-Info "Pulling llama3 (downloads ~4GB, first time only)..."
        ollama pull llama3
        Write-Ok "Model installed"
    }
} else {
    Write-Skip "Skipping Ollama. You can install it later: https://ollama.com/"
}

# ── 7. Set up API key ──
Write-Step "Setting up DeepSeek API key (optional)"
$apiKey = Read-Host "Enter your DeepSeek API key (or press Enter to skip)"
if ($apiKey -and $apiKey.Trim()) {
    [Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", $apiKey.Trim(), "User")
    $env:DEEPSEEK_API_KEY = $apiKey.Trim()
    Write-Ok "API key saved (User-level environment variable)"
    Write-Info "It will be available in new terminals. To set it in your current session:"
    Write-Info '$env:DEEPSEEK_API_KEY = "' + $apiKey.Trim() + '"'
} else {
    Write-Skip "Skipping API key. You can set it later via:"
    Write-Info '$env:DEEPSEEK_API_KEY = "sk-..."'
}

# ── 8. Developer tools (optional) ──
Write-Step "Developer tools (optional)"
$dev = Read-Host "Install dev tools (graphify, agent constraints, pre-commit hooks)? (y/N)"
if ($dev -eq "y") {
    # Graphify — code graph tool for agent-driven development
    if (Get-Command graphify -ErrorAction SilentlyContinue) {
        Write-Ok "Graphify already found"
    } else {
        Write-Info "Graphify is a compiled binary for generating code dependency graphs."
        Write-Info "Fetching latest release from GitHub..."

        $githubApi = "https://api.github.com/repos/anthropics/graphify/releases/latest"
        try {
            $release = Invoke-RestMethod -Uri $githubApi -UseBasicParsing -ErrorAction Stop
            # Find the Windows x64 asset
            $asset = $release.assets | Where-Object { $_.name -match 'windows.*amd64' -or $_.name -match 'x86_64' }
            if (-not $asset) {
                Write-Skip "No Windows x64 release found. Available:"
                $release.assets | ForEach-Object { Write-Info "  $($_.name)" }
                $dl = Read-Host "  Paste download URL manually (or Enter to skip)"
                if ($dl -and $dl.Trim()) { $assetUrl = $dl.Trim() } else { $assetUrl = $null }
            } else {
                $assetUrl = $asset.browser_download_url
                Write-Ok "Found: $($asset.name)"
            }

            if ($assetUrl) {
                $graphifyDest = "$env:USERPROFILE\.local\bin\graphify.exe"
                [System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($graphifyDest)) | Out-Null
                Write-Info "Downloading..."
                Invoke-WebRequest -Uri $assetUrl -OutFile $graphifyDest -UseBasicParsing
                $graphifyBinDir = [System.IO.Path]::GetDirectoryName($graphifyDest)
                if (-not $env:PATH.Split(';').Contains($graphifyBinDir)) {
                    $env:PATH = "$graphifyBinDir;$env:PATH"
                }
                Write-Ok "Graphify installed to $graphifyDest"
            } else {
                Write-Skip "Skipping graphify"
            }
        } catch {
            Write-Err "Failed to fetch release: $_"
            Write-Info "Download manually from https://github.com/anthropics/graphify/releases"
        }
    }

    # Generate initial graphify output
    if (Get-Command graphify -ErrorAction SilentlyContinue) {
        Write-Info "Generating initial code graph..."
        graphify update . 2>&1 | Out-Null
        if (Test-Path "graphify-out") {
            Write-Ok "Code graph generated (graphify-out/)"
        }
    }

    # Pre-commit hooks
    if (Get-Command pre-commit -ErrorAction SilentlyContinue) {
        Write-Ok "pre-commit already installed"
    } else {
        $hooks = Read-Host "Install pre-commit hooks? (y/N)"
        if ($hooks -eq "y") {
            poetry run pre-commit install
            Write-Ok "Pre-commit hooks installed"
        }
    }
} else {
    Write-Skip "Skipping dev tools. You can install them later."
}

# ── Done ──
Write-Host "`n========================================" -ForegroundColor White
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor White
Write-Host ""
Write-Host "Try it out:" -ForegroundColor White
Write-Host "  poetry run textgenhub ollama --prompt 'hello'" -ForegroundColor Gray
Write-Host "  poetry run textgenhub deepseek-api --prompt 'hello'" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  - Web UI providers (ChatGPT, etc.) require Chrome/Chromium" -ForegroundColor Gray
Write-Host "  - Download: https://www.google.com/chrome/" -ForegroundColor Gray
Write-Host ""
