import { randomUUID } from 'crypto';
import { pool, withSecurityContext } from './postgres';

async function main() {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const assetA = randomUUID();
  const assetB = randomUUID();

  try {
    await withSecurityContext(null, true, async client => {
      await client.query(`INSERT INTO organizations (id, name, slug) VALUES ($1, 'RLS Test A', $2), ($3, 'RLS Test B', $4)`, [orgA, `rls-test-a-${orgA.slice(0, 8)}`, orgB, `rls-test-b-${orgB.slice(0, 8)}`]);
      await client.query(`INSERT INTO assets (id, organization_id, hostname, asset_type) VALUES ($1, $2, 'RLS-A', 'Server'), ($3, $4, 'RLS-B', 'Server')`, [assetA, orgA, assetB, orgB]);
    });

    const visibleToA = await withSecurityContext(orgA, false, client => client.query(`SELECT id FROM assets WHERE id IN ($1, $2) ORDER BY id`, [assetA, assetB]));
    if (visibleToA.rows.length !== 1 || visibleToA.rows[0].id !== assetA) throw new Error('RLS read isolation failed');

    let crossTenantWriteBlocked = false;
    try {
      await withSecurityContext(orgA, false, client => client.query(`INSERT INTO assets (id, organization_id, hostname, asset_type) VALUES ($1, $2, 'RLS-CROSS-TENANT', 'Server')`, [randomUUID(), orgB]));
    } catch {
      crossTenantWriteBlocked = true;
    }
    if (!crossTenantWriteBlocked) throw new Error('RLS write isolation failed');

    const visibleToB = await withSecurityContext(orgB, false, client => client.query(`SELECT id FROM assets WHERE id IN ($1, $2) ORDER BY id`, [assetA, assetB]));
    if (visibleToB.rows.length !== 1 || visibleToB.rows[0].id !== assetB) throw new Error('RLS reverse isolation failed');

    await withSecurityContext(null, true, async client => {
      await client.query('DELETE FROM assets WHERE id IN ($1, $2)', [assetA, assetB]);
      await client.query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgA, orgB]);
    });

    console.log('[RLS] tenant read/write isolation passed');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error('[RLS] test failed:', error);
  process.exitCode = 1;
});
