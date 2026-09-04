import { performance } from 'perf_hooks';
import { db } from '../server/db/store';
import { AgentService } from '../server/services/agentService';

interface BenchmarkTierResult {
  endpointCount: number;
  totalEventsProcessed: number;
  durationMs: number;
  throughputEventsPerSec: number;
  meanLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  alertsTriggered: number;
  incidentsCreated: number;
  memoryUsedMb: number;
}

export async function runTelemetryLoadTest(): Promise<BenchmarkTierResult[]> {
  console.log('================================================================');
  console.log('  PNGee CyberGuard — Telemetry Ingestion Load & Scale Benchmark');
  console.log('  Testing scale from 10 to 1,000 enrolled endpoints');
  console.log('================================================================\n');

  const tiers = [10, 50, 100, 500, 1000];
  const results: BenchmarkTierResult[] = [];
  const testOrgId = 'org-apex-logistics';

  const testOrg = db.organizations.find(o => o.id === testOrgId);
  if (testOrg) testOrg.maxAssets = 10000;

  for (const endpointCount of tiers) {
    const identities: any[] = [];
    for (let i = 0; i < endpointCount; i++) {
      const hostname = `PERF-HOST-${i.toString().padStart(4, '0')}`;
      const ip = `10.200.${Math.floor(i / 250)}.${(i % 250) + 1}`;
      const { rawToken } = AgentService.createEnrollmentToken({
        organizationId: testOrgId,
        name: `Load Test Token ${i}`,
        createdBy: 'usr-admin',
        osTarget: 'windows',
        maxUses: 1,
        isOneTimeUse: true,
      });

      const res = AgentService.enrollEndpoint({
        enrollmentToken: rawToken,
        hostname,
        os: 'Windows Server 2022 Standard',
        osVersion: '21H2',
        ipAddress: ip,
        macAddress: `00:50:56:${(i % 99).toString(16).padStart(2, '0')}:AA:BB`,
        agentVersion: '2.4.0',
      });

      const ep = db.endpointIdentities.find(e => e.endpointId === res.endpointId);
      if (ep) identities.push(ep);
    }

    const initialMem = process.memoryUsage().heapUsed;
    const latencies: number[] = [];
    const startTime = performance.now();
    const alertCountStart = db.alerts.length;
    const incidentCountStart = db.incidents.length;

    for (let i = 0; i < identities.length; i++) {
      const endpoint = identities[i];
      const asset = db.assets.find(a => a.id === endpoint.endpointId);
      if (!asset) continue;

      const opStart = performance.now();
      AgentService.processHeartbeat(endpoint, asset, endpoint.lastIp);
      AgentService.processSystemMetrics(endpoint, asset, {
        cpuUsagePercent: 24.5,
        memoryUsagePercent: 45.2,
        networkIo: { bytesReceived: 1048576, bytesSent: 524288 },
        storage: [{ driveLetter: 'C:', percentUsed: 28 }],
      });

      const hasSecurityDefect = i % 25 === 0;
      AgentService.processSecurityMetrics(endpoint, asset, {
        antivirusEnabled: !hasSecurityDefect,
        realTimeProtection: !hasSecurityDefect,
        firewallEnabled: !hasSecurityDefect,
      });

      for (let eventIndex = 0; eventIndex < 2; eventIndex++) {
        AgentService.recordNormalizedEvent({
          organization_id: testOrgId,
          asset_id: asset.id,
          event_type: eventIndex === 0 ? 'PROCESS_START' : 'NETWORK_CONNECTION',
          severity: hasSecurityDefect ? 'HIGH' : 'INFORMATIONAL',
          hostname: asset.hostname,
          metadata: { benchmark: true, endpointIndex: i, eventIndex },
        });
      }
      latencies.push(performance.now() - opStart);
    }

    const durationMs = performance.now() - startTime;
    const sorted = [...latencies].sort((a, b) => a - b);
    const percentile = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : 0;
    const totalEventsProcessed = identities.length * 5;

    results.push({
      endpointCount,
      totalEventsProcessed,
      durationMs,
      throughputEventsPerSec: durationMs ? (totalEventsProcessed / durationMs) * 1000 : 0,
      meanLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95LatencyMs: percentile(0.95),
      p99LatencyMs: percentile(0.99),
      alertsTriggered: db.alerts.length - alertCountStart,
      incidentsCreated: db.incidents.length - incidentCountStart,
      memoryUsedMb: (process.memoryUsage().heapUsed - initialMem) / 1024 / 1024,
    });
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTelemetryLoadTest().then(results => console.table(results)).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
