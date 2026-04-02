/**
 * Database initialization script.
 * Creates all tables from schema.sql and optionally seeds data.
 * 
 * Usage: node db/init-db.js [--seed]
 */
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function initDatabase() {
  const client = await pool.connect();
  try {
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    console.log('📦 Creating database tables...');
    await client.query(schema);
    console.log('✅ Database tables created successfully!');

    // Optionally seed data
    if (process.argv.includes('--seed')) {
      const seedPath = path.join(__dirname, 'seed.sql');
      const seed = fs.readFileSync(seedPath, 'utf-8');
      
      console.log('🌱 Seeding database...');
      await client.query(seed);
      console.log('✅ Database seeded successfully!');
    }

  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase();
