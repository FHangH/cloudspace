const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../database');
const router = express.Router();

// Middleware to check admin privileges
const requireAdmin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
};

// Get all users
router.get('/users', requireAdmin, (req, res) => {
    db.all('SELECT id, username, is_admin, is_banned, created_at FROM users', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Ban/Unban user
router.put('/users/:id/ban', requireAdmin, (req, res) => {
    const userId = req.params.id;
    const { banned } = req.body;

    // Prevent banning root admin
    db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.username === 'root') {
            return res.status(400).json({ error: 'Cannot ban root admin' });
        }

        db.run('UPDATE users SET is_banned = ? WHERE id = ?', [banned ? 1 : 0, userId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: banned ? 'User banned' : 'User unbanned' });
        });
    });
});

// Delete user
router.delete('/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;

    // Prevent deleting root admin
    db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.username === 'root') {
            return res.status(400).json({ error: 'Cannot delete root admin' });
        }

        // Delete user's files from disk
        db.all('SELECT path FROM files WHERE user_id = ?', [userId], (err, files) => {
            if (err) console.error('Error fetching user files:', err);

            // Delete files from disk
            files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error('Error deleting file:', err);
                });
            });

            // Delete user's files from database
            db.run('DELETE FROM files WHERE user_id = ?', [userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Delete user
                db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'User and their files deleted' });
                });
            });
        });
    });
});

// Get user's files
router.get('/users/:id/files', requireAdmin, (req, res) => {
    const userId = req.params.id;
    db.all('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Download file content (admin can access any file)
router.get('/files/:id/content', requireAdmin, (req, res) => {
    const fileId = req.params.id;

    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: 'File not found' });

        const absolutePath = path.resolve(file.path);

        // Set proper headers for Chinese filename support
        const encodedFilename = encodeURIComponent(file.original_name);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');

        res.sendFile(absolutePath);
    });
});

// View file inline (admin can access any file)
router.get('/files/:id/view', requireAdmin, (req, res) => {
    const fileId = req.params.id;

    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: 'File not found' });

        const absolutePath = path.resolve(file.path);

        // Set headers for inline display
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', 'inline');

        res.sendFile(absolutePath);
    });
});

// Delete any file (admin)
router.delete('/files/:id', requireAdmin, (req, res) => {
    const fileId = req.params.id;

    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: 'File not found' });

        // Delete from disk
        fs.unlink(file.path, (err) => {
            if (err) console.error('Failed to delete file from disk:', err);

            // Delete from DB
            db.run('DELETE FROM files WHERE id = ?', [fileId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'File deleted successfully' });
            });
        });
    });
});

module.exports = router;
