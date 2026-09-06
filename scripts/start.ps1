param([switch]$SetupOnly)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    Set-Location -LiteralPath $projectRoot
    $runtimeRoot = Join-Path $projectRoot '.runtime'
    $nodeVersion = '24.20.0'
    $architecture = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $architecture = $env:PROCESSOR_ARCHITEW6432 }
    switch ($architecture) {
        'AMD64' { $nodeArch = 'x64' }
        'ARM64' { $nodeArch = 'arm64' }
        default { throw 'This launcher requires 64-bit Windows (x64 or ARM64).' }
    }

    $archiveName = "node-v$nodeVersion-win-$nodeArch"
    $nodeRoot = Join-Path $runtimeRoot $archiveName
    $nodeExe = Join-Path $nodeRoot 'node.exe'
    $npmCli = Join-Path $nodeRoot 'node_modules\npm\bin\npm-cli.js'
    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

    if (!(Test-Path -LiteralPath $nodeExe) -or !(Test-Path -LiteralPath $npmCli)) {
        Write-Host '[1/3] Downloading Node.js. First launch requires internet access...'
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $releaseUrl = "https://nodejs.org/dist/v$nodeVersion"
        $zipName = "$archiveName.zip"
        $zipPath = Join-Path $runtimeRoot $zipName
        $checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/SHASUMS256.txt").Content
        $checksumPattern = '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($zipName) + '\s*$'
        $checksumMatch = [regex]::Match($checksums, $checksumPattern)
        if (!$checksumMatch.Success) { throw 'Could not find the Node.js download checksum.' }
        Invoke-WebRequest -UseBasicParsing -Uri "$releaseUrl/$zipName" -OutFile $zipPath
        if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash -ne $checksumMatch.Groups[1].Value) {
            throw 'Node.js download verification failed. Please double-click start.bat to retry.'
        }
        Expand-Archive -LiteralPath $zipPath -DestinationPath $runtimeRoot -Force
        Remove-Item -LiteralPath $zipPath
    }

    & $nodeExe --version
    if ($LASTEXITCODE -ne 0) { throw 'Node.js could not start on this computer.' }
    $env:PATH = "$nodeRoot;$env:PATH"
    $env:npm_config_cache = Join-Path $runtimeRoot 'npm-cache'
    $lockHash = (Get-FileHash -LiteralPath (Join-Path $projectRoot 'package-lock.json') -Algorithm SHA256).Hash
    $installKey = "$nodeVersion-$nodeArch-$lockHash"
    $installStamp = Join-Path $runtimeRoot 'dependencies.txt'
    $installedKey = if (Test-Path -LiteralPath $installStamp) { (Get-Content -LiteralPath $installStamp -Raw).Trim() } else { '' }
    $viteCli = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'

    if ($installedKey -ne $installKey -or !(Test-Path -LiteralPath $viteCli)) {
        Write-Host '[2/3] Installing project dependencies. Please wait...'
        # Remove the success marker first so an interrupted install is retried.
        if (Test-Path -LiteralPath $installStamp) { Remove-Item -LiteralPath $installStamp }
        & $nodeExe $npmCli ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection and retry.' }
        Set-Content -LiteralPath $installStamp -Value $installKey -Encoding ASCII
    } else {
        Write-Host '[2/3] Dependencies are ready.'
    }

    if ($SetupOnly) { exit 0 }
    Write-Host '[3/3] Opening the library tour in your browser...'
    Write-Host 'Keep this window open while using the tour. Press Ctrl+C to stop.'
    & $nodeExe $viteCli --host 127.0.0.1 --open
    if ($LASTEXITCODE -ne 0) { throw 'The web server could not start.' }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
