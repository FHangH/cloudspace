const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Starting database migration...');

db.serialize(() => {
    // Add is_admin column if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding is_admin column:', err);
        } else {
            console.log('✓ Added is_admin column');
        }
    });

    // Add is_banned column if it doesn't exist
    db.run(`ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding is_banned column:', err);
        } else {
            console.log('✓ Added is_banned column');
        }
    });

    // Wait a bit for columns to be added, then create root admin
    setTimeout(() => {
        const rootPassword = bcrypt.hashSync('root', 10);
        db.run(`INSERT OR IGNORE INTO users (username, password, is_admin) VALUES (?, ?, ?)`,
            ['root', rootPassword, 1],
            (err) => {
                if (err && !err.message.includes('UNIQUE constraint')) {
                    console.error('Error creating root admin:', err);
                } else if (!err) {
                    console.log('✓ Created root admin account (root/root)');
                } else {
                    // Root already exists, update to make sure it's admin
                    db.run(`UPDATE users SET is_admin = 1 WHERE username = 'root'`, (err) => {
                        if (err) {
                            console.error('Error updating root admin:', err);
                        } else {
                            console.log('✓ Updated existing root account to admin');
                        }
                    });
                }

                console.log('\nMigration complete! You can now restart the server.');
                db.close();
                process.exit(0);
            }
        );
    }, 500);
});
