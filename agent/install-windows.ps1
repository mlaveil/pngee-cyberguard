$ErrorActionPreference = 'Stop'

if (-not $env:CYBERGUARD_URL) { throw 'Set CYBERGUARD_URL before installation.' }
if (-not $env:CYBERGUARD_ENROLLMENT_TOKEN) { throw 'Set CYBERGUARD_ENROLLMENT_TOKEN before installation.' }

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js 22+ is required.' }
$major = [int](& node -p 'process.versions.node.split(".")[0]')
if ($major -lt 22) { throw 'Node.js 22+ is required.' }

$InstallDir = if ($env:INSTALL_DIR) { $env:INSTALL_DIR } else { 'C:\Program Files\PNGee CyberGuard Agent' }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item "$PSScriptRoot\agent.ts" "$InstallDir\agent.ts" -Force
Copy-Item "$PSScriptRoot\README.md" "$InstallDir\README.md" -Force

$envFile = Join-Path $InstallDir 'agent.env.ps1'
@"
`$env:CYBERGUARD_URL='$($env:CYBERGUARD_URL.Replace("'", "''"))'
`$env:CYBERGUARD_ENROLLMENT_TOKEN='$($env:CYBERGUARD_ENROLLMENT_TOKEN.Replace("'", "''"))'
`$env:CYBERGUARD_AGENT_STATE='$((Join-Path $InstallDir 'agent.json').Replace("'", "''"))'
"@ | Set-Content -Path $envFile -Encoding UTF8

$nodePath = $node.Source
$action = New-ScheduledTaskAction -Execute $nodePath -Argument "--import tsx `"$InstallDir\agent.ts`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'PNGee CyberGuard Endpoint Agent' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'PNGee CyberGuard Endpoint Agent'
Write-Host 'PNGee CyberGuard Endpoint Agent installed and started.'
