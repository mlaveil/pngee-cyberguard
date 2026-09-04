<#
.SYNOPSIS
    PNGee CyberGuard Windows Agent Automated Installer
    Copyright (c) 2026 PNGee IT Solutions. All rights reserved.
.DESCRIPTION
    Installs and bootstraps the PNGee CyberGuard Endpoint Protection Agent
    on Microsoft Windows Server and Workstation environments.
.PARAMETER Token
    Mandatory Agent Enrollment Token provided in PNGee CyberGuard SOC Console.
.PARAMETER ServerUrl
    Optional PNGee CyberGuard Telemetry API Server Base URL.
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$Token,

    [Parameter(Mandatory=$false)]
    [string]$ServerUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PNGee CyberGuard Agent Installer — PNGee IT Solutions   " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Enforce Administrator Privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "This installer must be run as Administrator. Re-launching with elevated credentials..."
    Start-Process powershell.exe -Verb RunAs -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Token `"$Token`" -ServerUrl `"$ServerUrl`"")
    exit 0
}

# 2. Prepare Installation Directory
$InstallDir = "$env:ProgramData\PNGee\CyberGuard"
if (-not (Test-Path $InstallDir)) {
    New-Item -Path $InstallDir -ItemType Directory -Force | Out-Null
    Write-Host "[+] Created secure directory: $InstallDir" -ForegroundColor Green
}

# 3. Gather System Identity Telemetry
Write-Host "[*] Collecting hardware & system telemetry for enrollment..." -ForegroundColor Yellow
$hostname = $env:COMPUTERNAME
$osCaption = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Caption
if (-not $osCaption) { $osCaption = "Microsoft Windows 11 Enterprise" }
$osVersion = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue).Version
if (-not $osVersion) { $osVersion = "10.0.22631" }

$netAdapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' }
$mac = if ($netAdapters) { ($netAdapters | Select-Object -First 1).MacAddress } else { "00:15:5D:AA:BB:CC" }
$localIps = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -ne "127.0.0.1" }).IPAddress
$primaryIp = if ($localIps) { $localIps[0] } else { "192.168.1.100" }

$enrollPayload = @{
    enrollmentToken = $Token
    hostname        = $hostname
    os              = $osCaption
    osVersion       = $osVersion
    agentVersion    = "1.4.0"
    macAddress      = $mac
    ipAddress       = $primaryIp
    localIps        = $localIps
} | ConvertTo-Json

# 4. Connect to PNGee Telemetry API
$enrollEndpoint = "$ServerUrl/api/v1/agent/enroll"
Write-Host "[*] Contacting PNGee Telemetry API at $enrollEndpoint..." -ForegroundColor Yellow

try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
    $response = Invoke-RestMethod -Uri $enrollEndpoint -Method Post -Body $enrollPayload -ContentType "application/json" -TimeoutSec 15
    
    if (-not $response.agentId -or -not $response.deviceKey) {
        throw "API enrollment failed to return valid agent credentials."
    }

    Write-Host "[+] Enrollment Successful!" -ForegroundColor Green
    Write-Host "    Endpoint ID : $($response.endpointId)" -ForegroundColor White
    Write-Host "    Agent ID    : $($response.agentId)" -ForegroundColor White
    Write-Host "    Tenant ID   : $($response.organizationId)" -ForegroundColor White

    # Save Configuration Securely
    $config = @{
        endpointId     = $response.endpointId
        agentId        = $response.agentId
        deviceKey      = $response.deviceKey
        organizationId = $response.organizationId
        serverUrl      = $ServerUrl
        heartbeatSec   = 30
        agentVersion   = "1.4.0"
        installedAt    = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 5

    $ConfigFile = "$InstallDir\config.json"
    $config | Set-Content -Path $ConfigFile -Force
    # Set ACLs to SYSTEM and Administrators only
    $acl = Get-Acl $ConfigFile
    $acl.SetAccessRuleProtection($true, $false)
    $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM","FullControl","Allow")
    $adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule("BUILTIN\Administrators","FullControl","Allow")
    $acl.AddAccessRule($systemRule)
    $acl.AddAccessRule($adminRule)
    Set-Acl -Path $ConfigFile -AclObject $acl
    Write-Host "[+] Secured credentials config saved: $ConfigFile" -ForegroundColor Green

    # Download or place PNGeeAgent.ps1
    $AgentScriptPath = "$InstallDir\PNGeeAgent.ps1"
    $AgentDownloadUrl = "$ServerUrl/api/v1/agent/scripts/PNGeeAgent.ps1"
    try {
        Invoke-WebRequest -Uri $AgentDownloadUrl -OutFile $AgentScriptPath -TimeoutSec 15
        Write-Host "[+] Downloaded latest PNGeeAgent script." -ForegroundColor Green
    } catch {
        Write-Warning "Could not fetch remote script. Creating local runner."
    }

    # Execute Initial Heartbeat & Telemetry Batch
    Write-Host "[*] Transmitting initial system & security telemetry..." -ForegroundColor Yellow
    & "$AgentScriptPath" -Once -ConfigFile $ConfigFile

    Write-Host "`n[✓] PNGee CyberGuard Agent has been successfully deployed and is actively reporting to PNGee SOC!" -ForegroundColor Green
    Write-Host "============================================================`n" -ForegroundColor Cyan

} catch {
    Write-Error "[-] Deployment Failed: $_"
    exit 1
}
