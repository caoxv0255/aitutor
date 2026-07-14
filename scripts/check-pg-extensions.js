import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const r1 = await pool.query('SHOW server_version');
  console.log('PG Version:', r1.rows[0].server_version);

  const r2 = await pool.query("SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN ('age','vector','pg_stat_statements','pg_cron') ORDER BY name");
  console.log('\nAvailable extensions:');
  for (const row of r2.rows) {
    const installed = row.installed_version ? ` [INSTALLED v${row.installed_version}]` : '';
    console.log(`  ${row.name}: v${row.default_version}${installed}`);
  }

  // Check extension directory
  const r3 = await pool.query("SHOW data_directory");
  console.log('\nData directory:', r3.rows[0].data_directory);

  // Check shared_preload_libraries
  const r4 = await pool.query("SHOW shared_preload_libraries");
  console.log('shared_preload_libraries:', r4.rows[0].shared_preload_libraries || '(none)');

} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
