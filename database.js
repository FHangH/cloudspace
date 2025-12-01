const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            is_banned BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Files table
        db.run(`CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER,
            category TEXT,
            path TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Share tokens table for public file access
        db.run(`CREATE TABLE IF NOT EXISTS share_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
        )`);

        // Create default root admin account
        const bcrypt = require('bcrypt');
        const rootPassword = bcrypt.hashSync('root', 10);
        db.run(`INSERT OR IGNORE INTO users (username, password, is_admin) VALUES (?, ?, ?)`,
            ['root', rootPassword, 1],
            (err) => {
                if (err && !err.message.includes('UNIQUE constraint')) {
                    console.error('Error creating root admin:', err);
                } else if (!err) {
                    console.log('Default admin account created: root/root');
                }
            }
        );
    });
}

module.exports = db;
