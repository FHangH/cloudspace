const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

console.log('Running database migration...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
    console.log('Connected to database');
});

db.serialize(() => {
    // Check if share_tokens table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='share_tokens'", (err, row) => {
        if (err) {
            console.error('Error checking table:', err);
            process.exit(1);
        }

        if (!row) {
            console.log('Creating share_tokens table...');
            db.run(`CREATE TABLE share_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error('Error creating table:', err);
                    process.exit(1);
                }
                console.log('✅ share_tokens table created successfully');
                db.close();
            });
        } else {
            console.log('✅ share_tokens table already exists');
            db.close();
        }
    });
});
