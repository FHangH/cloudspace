const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../database');
const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'User registered successfully', userId: this.lastID });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        // Check if user is banned
        if (user.is_banned) {
            return res.status(403).json({ error: 'Account has been banned' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.isAdmin = user.is_admin;
            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.username,
                    isAdmin: user.is_admin
                }
            });
        } else {
            res.status(400).json({ error: 'Invalid credentials' });
        }
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

// Get Current User
router.get('/me', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            user: {
                id: req.session.userId,
                username: req.session.username,
                isAdmin: req.session.isAdmin || false
            }
        });
    } else {
        res.json({ authenticated: false, user: null });
    }
});

// Change Password
router.post('/change-password', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters' });
    }

    try {
        db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });

            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
                return res.status(400).json({ error: 'Current password is incorrect' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.session.userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Password changed successfully' });
            });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
