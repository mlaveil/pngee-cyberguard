<# PNGee CyberGuard Windows Agent Installer #>
param([Parameter(Mandatory=$true)][string]$Token,[Parameter(Mandatory=$false)][string]$ServerUrl="https://localhost:3000")
$ErrorActionPreference='Stop'
if(-not([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){Start-Process powershell.exe -Verb RunAs -ArgumentList ("-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Token `"$Token`" -ServerUrl `"$ServerUrl`"");exit 0}
if(-not([Uri]$ServerUrl).IsAbsoluteUri){throw 'ServerUrl must be an absolute HTTPS URL.'}
if(([Uri]$ServerUrl).Scheme -ne 'https'){throw 'ServerUrl must use HTTPS. Do not deploy the agent over plaintext HTTP.'}
$InstallDir="$env:ProgramData\PNGee\CyberGuard";New-Item -Path $InstallDir -ItemType Directory -Force|Out-Null
$os=Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue;$adapters=Get-NetAdapter -ErrorAction SilentlyContinue|Where-Object Status -eq 'Up';$ips=@(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue|Where-Object IPAddress -ne '127.0.0.1'|Select-Object -ExpandProperty IPAddress)
$payload=@{enrollmentToken=$Token;hostname=$env:COMPUTERNAME;os=if($os){$os.Caption}else{'Windows'};osVersion=if($os){$os.Version}else{'Unknown'};agentVersion='1.4.0';macAddress=if($adapters){($adapters|Select-Object -First 1).MacAddress}else{$null};ipAddress=if($ips){$ips[0]}else{$null};localIps=$ips}|ConvertTo-Json -Depth 6
$response=Invoke-RestMethod -Uri "$($ServerUrl.TrimEnd('/'))/api/v1/agent/enroll" -Method Post -Body $payload -ContentType 'application/json' -TimeoutSec 15
if(-not $response.agentId -or -not $response.deviceKey){throw 'Enrollment did not return agent credentials.'}
$config=@{endpointId=$response.endpointId;agentId=$response.agentId;deviceKey=$response.deviceKey;organizationId=$response.organizationId;serverUrl=$ServerUrl.TrimEnd('/');heartbeatSec=30;agentVersion='1.4.0';installedAt=(Get-Date).ToUniversalTime().ToString('o')}|ConvertTo-Json -Depth 5
$configFile="$InstallDir\config.json";$config|Set-Content -Path $configFile -Force -Encoding UTF8
$acl=Get-Acl $configFile;$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule('NT AUTHORITY\SYSTEM','FullControl','Allow')));$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule('BUILTIN\Administrators','FullControl','Allow')));Set-Acl $configFile $acl
$agentScript="$InstallDir\PNGeeAgent.ps1";Invoke-WebRequest -Uri "$($ServerUrl.TrimEnd('/'))/api/v1/agent/scripts/PNGeeAgent.ps1" -OutFile $agentScript -TimeoutSec 15
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $agentScript -Once -ConfigFile $configFile
Write-Host '[+] PNGee CyberGuard agent installed and authenticated telemetry initialized.' -ForegroundColor Green