import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const BASE_URL = (process.env.CYBERGUARD_URL || 'https://127.0.0.1:3000').replace(/\/$/, '');
const ALLOW_INSECURE = process.env.CYBERGUARD_ALLOW_INSECURE === 'true';
if (!BASE_URL.startsWith('https://') && !ALLOW_INSECURE) {
  throw new Error('CYBERGUARD_URL must use HTTPS. Set CYBERGUARD_ALLOW_INSECURE=true only for isolated development/lab use.');
}
const ENROLLMENT_TOKEN = process.env.CYBERGUARD_ENROLLMENT_TOKEN || '';
const STATE_FILE = process.env.CYBERGUARD_AGENT_STATE || path.join(os.homedir(), '.pngee-cyberguard', 'agent.json');
const DEFAULT_HEARTBEAT_SECONDS = Math.max(15, Number(process.env.CYBERGUARD_HEARTBEAT_SECONDS || 30));

type AgentState = {
  endpointId: string;
  agentId: string;
  deviceKey: string;
  organizationId: string;
  hostname: string;
  os?: string;
  osVersion?: string;
  agentVersion: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const canonical = (timestamp: string, method: string, requestPath: string, body: string) => `${timestamp}\n${method}\n${requestPath}\n${body}`;

async function command(file: string, args: string[] = [], timeout = 5000): Promise<string> {
  try {
    const result = await exec(file, args, { timeout, windowsHide: true, maxBuffer: 1024 * 1024 });
    return result.stdout.trim();
  } catch {
    return '';
  }
}

async function readState(): Promise<AgentState | null> {
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) as AgentState; } catch { return null; }
}

async function writeState(state: AgentState) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  try { await fs.chmod(STATE_FILE, 0o600); } catch { /* Windows ACLs are managed by the host account. */ }
}

async function request(state: AgentState, requestPath: string, payload: unknown) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = crypto.randomUUID();
  const body = JSON.stringify(payload ?? {});
  const signature = crypto.createHmac('sha256', state.deviceKey).update(canonical(timestamp, 'POST', requestPath, body)).digest('hex');
  const response = await fetch(`${BASE_URL}${requestPath}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-agent-id': state.agentId,
      'x-timestamp': timestamp,
      'x-agent-signature': signature,
      'x-request-id': requestId
    },
    body
  });
  if (!response.ok) throw new Error(`Telemetry request failed: ${response.status}`);
  return response.json();
}

async function enroll(): Promise<AgentState> {
  if (!ENROLLMENT_TOKEN) throw new Error('CYBERGUARD_ENROLLMENT_TOKEN is required for first enrollment.');
  const hostname = os.hostname();
  const platform = process.platform === 'win32' ? 'Windows' : 'Linux';
  const response = await fetch(`${BASE_URL}/agent/enroll`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      enrollmentToken: ENROLLMENT_TOKEN,
      hostname,
      os: platform,
      osVersion: os.release(),
      agentVersion: '3.1.0',
      localIps: Object.values(os.networkInterfaces()).flatMap(items => (items || []).map(item => item.address)).filter(Boolean)
    })
  });
  if (!response.ok) throw new Error(`Enrollment failed: ${response.status} ${await response.text()}`);
  const result = await response.json() as AgentState & { config?: { heartbeatIntervalSeconds?: number } };
  const state: AgentState = { endpointId: result.endpointId, agentId: result.agentId, deviceKey: result.deviceKey, organizationId: result.organizationId, hostname, os: platform, osVersion: os.release(), agentVersion: '3.1.0' };
  await writeState(state);
  return state;
}

async function systemTelemetry() {
  const total = os.totalmem(), free = os.freemem();
  const cpus = os.cpus();
  const load = os.loadavg()[0];
  const cpuUsagePercent = Math.min(100, Math.round((load / Math.max(cpus.length, 1)) * 100));
  const ramUsagePercent = Math.round(((total - free) / total) * 100);
  const processList = process.platform === 'win32' ? await command('tasklist', ['/FO', 'CSV', '/NH']) : await command('ps', ['-e']);
  const runningProcesses = processList ? processList.split(/\r?\n/).filter(Boolean).length : undefined;
  const loggedIn = process.platform === 'win32' ? await command('query', ['user']) : await command('who');
  return { cpuUsagePercent, ramUsagePercent, runningProcesses, loggedInUsers: loggedIn ? loggedIn.split(/\r?\n/).filter(Boolean).length : undefined };
}

async function securityTelemetry() {
  if (process.platform === 'win32') {
    const firewall = await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-NetFirewallProfile | Where-Object Enabled -eq $false).Count']);
    const defender = await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-MpComputerStatus).AntivirusEnabled']);
    return { firewallEnabled: firewall === '0', antivirusEnabled: defender.toLowerCase() === 'true' };
  }
  const firewall = await command('sh', ['-c', 'command -v ufw >/dev/null && ufw status | grep -q "Status: active" || command -v nft >/dev/null && nft list ruleset | grep -q .']);
  const av = await command('sh', ['-c', 'command -v clamscan >/dev/null && echo true || (systemctl is-active --quiet clamav-daemon && echo true || echo false)']);
  return { firewallEnabled: Boolean(firewall), antivirusEnabled: av === 'true' };
}

async function serviceTelemetry(state: AgentState) {
  let services: Array<Record<string, string>> = [];
  if (process.platform === 'win32') {
    const raw = await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Service | Select-Object -First 100 Name,Status,StartType | ConvertTo-Json -Compress']);
    try { const parsed = JSON.parse(raw || '[]'); services = (Array.isArray(parsed) ? parsed : [parsed]).map((x: any) => ({ name: x.Name, status: x.Status, startType: x.StartType })); } catch { /* unavailable */ }
  } else {
    const raw = await command('systemctl', ['list-units', '--type=service', '--no-legend', '--plain']);
    services = raw.split(/\r?\n/).filter(Boolean).slice(0, 100).map(line => { const p = line.trim().split(/\s+/); return { name: p[0] || 'unknown', status: p[2] || 'unknown' }; });
  }
  if (services.length) await request(state, '/telemetry/services', { services });
}

async function securityEvents(state: AgentState) {
  let events: Array<Record<string, unknown>> = [];
  if (process.platform === 'win32') {
    const raw = await command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-WinEvent -FilterHashtable @{LogName="Security"; StartTime=(Get-Date).AddSeconds(-45)} -MaxEvents 100 | Select-Object Id,LevelDisplayName,ProviderName,TimeCreated,Message | ConvertTo-Json -Compress']);
    try { const parsed = JSON.parse(raw || '[]'); events = (Array.isArray(parsed) ? parsed : [parsed]).map((x: any) => ({ event_type: `windows_security_${x.Id}`, severity: x.LevelDisplayName === 'Error' ? 'HIGH' : 'INFORMATIONAL', timestamp: x.TimeCreated, metadata: { provider: x.ProviderName, message: String(x.Message || '').slice(0, 4000) } })); } catch { /* unavailable */ }
  } else {
    const raw = await command('journalctl', ['--since', '45 seconds ago', '-p', 'warning', '--no-pager', '-o', 'json']);
    events = raw.split(/\r?\n/).filter(Boolean).slice(-100).map(line => { try { const x = JSON.parse(line); return { event_type: `linux_journal_${x.PRIORITY || 'warning'}`, severity: Number(x.PRIORITY) <= 3 ? 'HIGH' : 'MEDIUM', timestamp: x.__REALTIME_TIMESTAMP ? new Date(Number(x.__REALTIME_TIMESTAMP) / 1000).toISOString() : undefined, metadata: { message: x.MESSAGE, unit: x._SYSTEMD_UNIT } }; } catch { return null; } }).filter(Boolean) as Array<Record<string, unknown>>;
  }
  if (events.length) await request(state, '/telemetry/events', events);
}

async function run() {
  let state = await readState();
  if (!state) state = await enroll();
  let consecutiveFailures = 0;
  while (true) {
    try {
      await request(state, '/telemetry/heartbeat', {});
      await request(state, '/telemetry/system', await systemTelemetry());
      await request(state, '/telemetry/security', await securityTelemetry());
      await Promise.all([serviceTelemetry(state), securityEvents(state)]);
      consecutiveFailures = 0;
    } catch (error) {
      consecutiveFailures += 1;
      console.error(`[CyberGuard Agent] telemetry cycle failed (${consecutiveFailures}):`, error instanceof Error ? error.message : error);
    }
    await sleep(Math.min(DEFAULT_HEARTBEAT_SECONDS, 300) * 1000 * Math.min(consecutiveFailures + 1, 4));
  }
}

run().catch(error => { console.error('[CyberGuard Agent] fatal:', error); process.exitCode = 1; });
