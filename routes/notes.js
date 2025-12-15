const express = require('express');
const db = require('../database');
const router = express.Router();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Create note
router.post('/', requireAuth, (req, res) => {
    const { title, content } = req.body;
    const userId = req.session.userId;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    db.run(
        'INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)',
        [userId, title, content],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Note created successfully', noteId: this.lastID });
        }
    );
});

// Get all notes for current user (with optional search)
router.get('/', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const search = req.query.search;

    let query = 'SELECT * FROM notes WHERE user_id = ?';
    let params = [userId];

    if (search) {
        query += ' AND title LIKE ?';
        params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get single note
router.get('/:id', requireAuth, (req, res) => {
    const noteId = req.params.id;
    const userId = req.session.userId;

    db.get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [noteId, userId], (err, note) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!note) return res.status(404).json({ error: 'Note not found' });
        res.json(note);
    });
});

// Update note
router.put('/:id', requireAuth, (req, res) => {
    const noteId = req.params.id;
    const userId = req.session.userId;
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    // Check if note belongs to user
    db.get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [noteId, userId], (err, note) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!note) return res.status(404).json({ error: 'Note not found' });

        db.run(
            'UPDATE notes SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [title, content, noteId],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Note updated successfully' });
            }
        );
    });
});

// Delete note
router.delete('/:id', requireAuth, (req, res) => {
    const noteId = req.params.id;
    const userId = req.session.userId;

    db.get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [noteId, userId], (err, note) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!note) return res.status(404).json({ error: 'Note not found' });

        db.run('DELETE FROM notes WHERE id = ?', [noteId], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Note deleted successfully' });
        });
    });
});

// Generate share link for note
router.post('/:id/share', requireAuth, (req, res) => {
    const noteId = req.params.id;
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin;

    let query = 'SELECT * FROM notes WHERE id = ?';
    let params = [noteId];

    if (!isAdmin) {
        query += ' AND user_id = ?';
        params.push(userId);
    }

    db.get(query, params, (err, note) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!note) return res.status(404).json({ error: 'Note not found' });

        // Check if share token already exists
        db.get('SELECT token FROM note_share_tokens WHERE note_id = ?', [noteId], (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });

            if (existing) {
                const shareUrl = `${req.protocol}://${req.get('host')}/api/notes/${noteId}/view?token=${existing.token}`;
                return res.json({ token: existing.token, shareUrl });
            }

            // Generate new token
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');

            db.run('INSERT INTO note_share_tokens (note_id, token) VALUES (?, ?)', [noteId, token], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                const shareUrl = `${req.protocol}://${req.get('host')}/api/notes/${noteId}/view?token=${token}`;
                res.json({ token, shareUrl });
            });
        });
    });
});

// View note (supports token for public access)
router.get('/:id/view', (req, res) => {
    const noteId = req.params.id;
    const token = req.query.token;

    if (token) {
        // Public access with token
        db.get('SELECT note_id FROM note_share_tokens WHERE token = ?', [token], (err, shareToken) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!shareToken || shareToken.note_id != noteId) {
                return res.status(403).json({ error: 'Invalid share token' });
            }

            db.get('SELECT * FROM notes WHERE id = ?', [noteId], (err, note) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!note) return res.status(404).json({ error: 'Note not found' });
                res.json(note);
            });
        });
    } else {
        // Authenticated access
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.session.userId;
        db.get('SELECT * FROM notes WHERE id = ? AND user_id = ?', [noteId, userId], (err, note) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!note) return res.status(404).json({ error: 'Note not found' });
            res.json(note);
        });
    }
});

module.exports = router;
