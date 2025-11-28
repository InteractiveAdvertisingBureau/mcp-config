// MySQL Database Connection
import mysql from 'mysql2/promise';

let pool = null;

/**
 * Initialize MySQL connection pool
 */
export function initializeDatabase() {
  if (pool) {
    console.error('⚠️ Database pool already initialized');
    return pool;
  }

  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mcp_api_testing',
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  try {
    pool = mysql.createPool(config);
    console.error('✅ MySQL connection pool created');
    console.error(`   - Host: ${config.host}:${config.port}`);
    console.error(`   - Database: ${config.database}`);
    console.error(`   - User: ${config.user}`);

    // Test connection
    testConnection();

    return pool;
  } catch (error) {
    console.error('❌ Failed to create database pool:', error.message);
    throw error;
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.error('✅ Database connection test successful');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection test failed:', error.message);
    throw error;
  }
}

/**
 * Get database connection pool
 */
export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query
 */
export async function query(sql, params = []) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    console.error('   SQL:', sql);
    console.error('   Params:', params);
    throw error;
  }
}

/**
 * Execute a query and return first result
 */
export async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results[0] || null;
}

/**
 * Begin transaction
 */
export async function beginTransaction() {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
}

/**
 * Close database connection pool
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    console.error('✅ Database connection pool closed');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});
