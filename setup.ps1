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

# Resolve our own path reliably (works for both .\script.ps1 and dot-source)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Definition
$SCRIPT_PATH = Join-Path $SCRIPT_DIR (Split-Path -Leaf $MyInvocation.MyCommand.Definition)

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Skip($msg) { Write-Host "  [SKIP] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info($msg) { Write-Host "      $msg" -ForegroundColor Gray }

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
    powershell -Command "Invoke-RestMethod 'https://install.python-poetry.org' | python -"
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
            Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$SCRIPT_PATH`""
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
$dev = Read-Host "Install dev tools (graphify code graph, pre-commit hooks)? (y/N)"
if ($dev -eq "y") {
    # Graphify — pip package 'graphifyy', module 'graphify', CLI: python -m graphify
    Write-Info "Installing graphifyy (code knowledge graph for agents)..."
    $graphifyCheck = python -c "import graphify" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "graphify already installed"
    } else {
        pip install graphifyy --quiet
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "graphifyy installed"
        } else {
            Write-Err "graphifyy install failed — skipping graph generation"
        }
    }

    # Generate initial code graph (AST-only, no LLM or API key needed)
    $graphifyCheck2 = python -c "import graphify" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Generating initial code graph (AST pass, no LLM needed)..."
        Push-Location $SCRIPT_DIR
        python -m graphify update . 2>&1 | Out-Null
        Pop-Location
        if (Test-Path (Join-Path $SCRIPT_DIR "graphify-out")) {
            Write-Ok "Code graph generated (graphify-out/)"
        } else {
            Write-Skip "graphify-out not created — run 'python -m graphify update .' manually"
        }
    }

    # Pre-commit hooks
    $hooks = Read-Host "Install pre-commit hooks? (y/N)"
    if ($hooks -eq "y") {
        Push-Location $SCRIPT_DIR
        poetry run pre-commit install
        Pop-Location
        Write-Ok "Pre-commit hooks installed"
    }
} else {
    Write-Skip "Skipping dev tools. Run 'pip install graphifyy' and 'python -m graphify update .' later."
}

# ── Done ──
Write-Host "`n========================================" -ForegroundColor White
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor White
Write-Host ""
Write-Host "Try it out:" -ForegroundColor White
Write-Host "  poetry run textgenhub ollama --prompt 'hello'" -ForegroundColor Gray
Write-Host "  poetry run textgenhub deepseek-api --prompt 'hello'" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  - Web UI providers (ChatGPT, etc.) require Chrome/Chromium" -ForegroundColor Gray
Write-Host "  - Download: https://www.google.com/chrome/" -ForegroundColor Gray
Write-Host ""
