import { getDb } from '../api/core/db.js';

async function main() {
  const db = await getDb();
  
  // 获取所有表
  const tables = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('=' .repeat(80));
  console.log('数据库表结构概览');
  console.log('='.repeat(80));
  console.log();
  
  for (const t of tables.rows) {
    const tableName = t.table_name;
    
    // 获取列信息
    const cols = await db.query(`
      SELECT 
        column_name, 
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    // 获取索引
    const idx = await db.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = $1
      ORDER BY indexname
    `, [tableName]);
    
    // 获取外键
    const fks = await db.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
    `, [tableName]);
    
    console.log(`## ${tableName}`);
    console.log('-'.repeat(60));
    
    // 列信息
    console.log('列:');
    for (const c of cols.rows) {
      let type = c.data_type;
      if (c.character_maximum_length) {
        type += `(${c.character_maximum_length})`;
      }
      const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const def = c.column_default ? ` DEFAULT ${c.column_default}` : '';
      console.log(`  ${c.column_name.padEnd(30)} ${type.padEnd(20)} ${nullable}${def}`);
    }
    
    // 外键
    if (fks.rows.length > 0) {
      console.log('\n外键:');
      for (const fk of fks.rows) {
        console.log(`  ${fk.column_name} → ${fk.foreign_table}.${fk.foreign_column}`);
      }
    }
    
    // 索引
    if (idx.rows.length > 0) {
      console.log('\n索引:');
      for (const i of idx.rows) {
        console.log(`  ${i.indexname}`);
      }
    }
    
    console.log('\n');
  }
  
  process.exit(0);
}

main().catch(console.error);