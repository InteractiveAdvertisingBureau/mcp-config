// Run database migration to add auth fields
import { getPool } from './database/connection.js';
import fs from 'fs';

async function runMigration() {
  try {
    console.log('🔄 Running migration: add_auth_fields.sql...');

    const pool = getPool();
    const migrationSQL = fs.readFileSync('./database/migrations/add_auth_fields.sql', 'utf8');

    // Split by semicolons to execute each statement separately
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().includes('alter table')) {
        try {
          await pool.query(statement);
          console.log('✅ Migration statement executed successfully');
        } catch (err) {
          // Ignore "duplicate column" errors
          if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  Columns already exist, skipping...');
          } else {
            throw err;
          }
        }
      }
    }

    // Verify columns were added
    const [columns] = await pool.query('DESCRIBE registered_apis');
    console.log('\n📋 Current table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
