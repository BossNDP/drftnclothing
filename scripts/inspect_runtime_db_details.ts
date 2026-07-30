import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually BEFORE any imports from src/db
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value.trim();
    }
  });
}

async function runRuntimeInspection() {
  const { Client } = await import('pg');
  const { db } = await import('../src/db/index');
  const schema = await import('../src/db/schema');

  const dbUrl = process.env.DATABASE_URL || '';
  const parsedUrl = new URL(dbUrl);

  console.log('====================================================');
  console.log('STEP 1 — DATABASE CONNECTION DETAILS');
  console.log('====================================================');
  console.log('DATABASE_URL Host:', parsedUrl.hostname);
  console.log('DATABASE_URL Database Name:', parsedUrl.pathname.replace('/', ''));
  console.log('DATABASE_URL Username:', parsedUrl.username);
  console.log('Full Connection Host/Endpoint:', parsedUrl.host);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  console.log('\n====================================================');
  console.log('STEP 2 — RUNTIME DATABASE QUERIES');
  console.log('====================================================');
  const dbNameRes = await client.query('SELECT current_database();');
  console.log('current_database():', dbNameRes.rows[0].current_database);

  const schemaRes = await client.query('SELECT current_schema();');
  console.log('current_schema():', schemaRes.rows[0].current_schema);

  const tablesRes = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name;
  `);
  console.log('Tables in public schema:', tablesRes.rows.map((r) => r.table_name).join(', '));

  console.log('\n====================================================');
  console.log('STEP 3 — INSPECT RUNTIME payments TABLE COLUMNS');
  console.log('====================================================');
  const paymentsCols = await client.query(`
    SELECT ordinal_position, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name='payments'
    ORDER BY ordinal_position;
  `);
  console.log('RAW payments COLUMNS OUTPUT:');
  console.log(JSON.stringify(paymentsCols.rows, null, 2));

  console.log('\n====================================================');
  console.log('STEP 4 — COMPARE schema.ts vs ACTUAL payments TABLE');
  console.log('====================================================');
  const actualColNames = new Set(paymentsCols.rows.map((r) => r.column_name));
  const expectedCols = [
    'id',
    'order_id',
    'razorpay_order_id',
    'razorpay_payment_id',
    'razorpay_signature',
    'amount',
    'status',
    'payment_type',
    'is_booking_payment',
    'raw_payload',
    'created_at',
    'updated_at',
  ];

  const missingCols = expectedCols.filter((c) => !actualColNames.has(c));
  console.log('Expected Columns in schema.ts:', expectedCols.join(', '));
  console.log('Actual Columns in PostgreSQL:', Array.from(actualColNames).join(', '));
  console.log('MISSING COLUMNS IN payments TABLE:', missingCols.length > 0 ? missingCols.join(', ') : 'NONE!');

  console.log('\n====================================================');
  console.log('STEP 5 — DRIZZLE ORM SELECT QUERY TEST ON payments');
  console.log('====================================================');
  try {
    const testResult = await db.select().from(schema.payments).limit(1);
    console.log('DRIZZLE SELECT SUCCESS! Rows returned:', testResult.length);
  } catch (err: any) {
    console.error('DRIZZLE SELECT FAILED!');
    console.error('Code:', err.code);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
  }

  await client.end();
}

runRuntimeInspection();
