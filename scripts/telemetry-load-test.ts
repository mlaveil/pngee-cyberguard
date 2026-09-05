import { performance } from 'perf_hooks';
import { query, withSecurityContext } from '../server/db/postgres';

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
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const tiers = [10, 50, 100, 500, 1000];
  const results: BenchmarkTierResult[] = [];
  const organizationId = 'org-apex-logistics';

  await withSecurityContext(organizationId, true, async client => {
    const org = await client.query('SELECT id FROM organizations WHERE id=$1', [organizationId]);
    if (!org.rowCount) throw new Error(`Benchmark organization ${organizationId} does not exist`);
  });

  for (const endpointCount of tiers) {
    const latencies: number[] = [];
    const startTime = performance.now();
    const before = await withSecurityContext(organizationId, true, async client => {
      const r = await client.query(`SELECT count(*)::int AS alerts, (SELECT count(*)::int FROM incidents) AS incidents FROM alerts`);
      return r.rows[0];
    });
    const initialMem = process.memoryUsage().heapUsed;

    for (let i = 0; i < endpointCount; i++) {
      const opStart = performance.now();
      await withSecurityContext(organizationId, true, async client => {
        const endpointId = `perf-${endpointCount}-${i}`;
        const assetPayload = JSON.stringify({ id: endpointId, hostname: `PERF-HOST-${i.toString().padStart(4, '0')}`, os: 'Windows Server 2022', benchmark: true });
        await client.query(`
          INSERT INTO assets (id, organization_id, hostname, status, last_seen, payload)
          VALUES ($1,$2,$3,'ONLINE',now(),$4)
          ON CONFLICT (id) DO UPDATE SET status='ONLINE',last_seen=now(),payload=$4
        `, [endpointId, organizationId, `PERF-HOST-${i.toString().padStart(4, '0')}`, assetPayload]);
        for (const eventType of ['HEARTBEAT','SYSTEM_METRICS','SECURITY_METRICS','PROCESS_START','NETWORK_CONNECTION']) {
          await client.query(`INSERT INTO security_events (id,organization_id,asset_id,event_type,severity,hostname,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
            `perf-${endpointCount}-${i}-${eventType.toLowerCase()}`, organizationId, endpointId, eventType,
            i % 25 === 0 ? 'HIGH' : 'INFORMATIONAL', `PERF-HOST-${i.toString().padStart(4, '0')}`,
            JSON.stringify({ benchmark: true, endpointIndex: i, eventType })
          ]);
        }
      });
      latencies.push(performance.now() - opStart);
    }

    const durationMs = performance.now() - startTime;
    const sorted = [...latencies].sort((a, b) => a - b);
    const percentile = (p: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : 0;
    const after = await withSecurityContext(organizationId, true, async client => {
      const r = await client.query(`SELECT count(*)::int AS alerts, (SELECT count(*)::int FROM incidents) AS incidents FROM alerts`);
      return r.rows[0];
    });

    results.push({
      endpointCount,
      totalEventsProcessed: endpointCount * 5,
      durationMs,
      throughputEventsPerSec: durationMs ? (endpointCount * 5 / durationMs) * 1000 : 0,
      meanLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95LatencyMs: percentile(0.95),
      p99LatencyMs: percentile(0.99),
      alertsTriggered: Number(after.alerts) - Number(before.alerts),
      incidentsCreated: Number(after.incidents) - Number(before.incidents),
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
