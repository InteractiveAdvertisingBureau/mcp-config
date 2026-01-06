// Simple script to update database schema
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function updateSchema() {
  let connection;
  try {
    console.log('🔄 Connecting to database...');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mcp_api_testing'
    });

    console.log('✅ Connected to database');
    console.log('🔄 Adding auth fields to registered_apis table...');

    // Add columns (IF NOT EXISTS is MySQL 8.0+ syntax, so we'll use try-catch for each)
    const alterStatements = [
      "ALTER TABLE registered_apis ADD COLUMN auth_required BOOLEAN DEFAULT FALSE AFTER description",
      "ALTER TABLE registered_apis ADD COLUMN auth_type VARCHAR(50) DEFAULT NULL AFTER auth_required",
      "ALTER TABLE registered_apis ADD COLUMN auth_token TEXT DEFAULT NULL AFTER auth_type"
    ];

    for (const statement of alterStatements) {
      try {
        await connection.execute(statement);
        console.log(`✅ Executed: ${statement.split('ADD COLUMN')[1].split('AFTER')[0].trim()}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  Column already exists: ${statement.split('ADD COLUMN')[1].split('AFTER')[0].trim()}`);
        } else {
          throw err;
        }
      }
    }

    // Verify the structure
    console.log('\n📋 Current table structure:');
    const [columns] = await connection.execute('DESCRIBE registered_apis');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n✅ Schema update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit(0);
  }
}

updateSchema();
