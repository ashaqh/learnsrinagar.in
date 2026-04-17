import { query } from './src/lib/db.js';

async function migrate() {
  console.log('Starting migration: Adding zoom_link to live_classes table...');
  try {
    // Check if column already exists
    const columns = await query('SHOW COLUMNS FROM live_classes LIKE "zoom_link"');
    if (columns.length > 0) {
      console.log('Column "zoom_link" already exists. Skipping migration.');
      return;
    }

    // Add the column
    await query('ALTER TABLE live_classes ADD COLUMN zoom_link VARCHAR(255) DEFAULT NULL AFTER youtube_live_link');
    console.log('Successfully added "zoom_link" column to "live_classes" table.');
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('\n--- MANUAL ACTION REQUIRED ---');
    console.log('Please execute the following SQL manually in your database:');
    console.log('ALTER TABLE live_classes ADD COLUMN zoom_link VARCHAR(255) DEFAULT NULL AFTER youtube_live_link;');
  } finally {
    process.exit();
  }
}

migrate();
