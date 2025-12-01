const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const username = req.session.username || 'unknown';
        const mimeType = file.mimetype;
        let category = 'documents';
        if (mimeType.startsWith('image/')) category = 'images';
        else if (mimeType.startsWith('video/')) category = 'videos';
        else if (mimeType.startsWith('audio/')) category = 'audio';

        const uploadPath = path.join(__dirname, '..', 'uploads', username, category);
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + originalName);
    }
});

const upload = multer({ storage: storage, limits: { fileSize: Infinity } });

function getCategory(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
}

const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { mimetype, size, filename, path: filePath } = req.file;
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const category = getCategory(mimetype);
    const userId = req.session.userId;

    db.run(`INSERT INTO files (user_id, filename, original_name, mime_type, size, category, path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, filename, originalname, mimetype, size, category, filePath],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'File uploaded successfully', fileId: this.lastID });
        });
});

router.get('/', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const category = req.query.category;

    let query = 'SELECT * FROM files WHERE user_id = ?';
    let params = [userId];

    if (category && category !== 'all') {
        query += ' AND category = ?';
        params.push(category);
    }

    query += ' ORDER BY created_at DESC';
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

router.get('/:id/content', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const fileId = req.params.id;

    db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId], (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: 'File not found' });

        const absolutePath = path.resolve(file.path);
        const encodedFilename = encodeURIComponent(file.original_name);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.sendFile(absolutePath);
    });
});

router.get('/:id/view', (req, res) => {
    const fileId = req.params.id;
    const token = req.query.token;

    if (token) {
        db.get('SELECT file_id FROM share_tokens WHERE token = ?', [token], (err, shareToken) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!shareToken || shareToken.file_id != fileId) {
                return res.status(403).json({ error: 'Invalid share token' });
            }

            db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!file) return res.status(404).json({ error: 'File not found' });

                const absolutePath = path.resolve(file.path);
                res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
                res.setHeader('Content-Disposition', 'inline');
                res.sendFile(absolutePath);
            });
        });
    } else {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const userId = req.session.userId;
        db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId], (err, file) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!file) return res.status(404).json({ error: 'File not found' });

            const absolutePath = path.resolve(file.path);
            res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
            res.setHeader('Content-Disposition', 'inline');
            res.sendFile(absolutePath);
        });
    }
});

router.post('/:id/share', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const isAdmin = req.session.isAdmin;
    const fileId = req.params.id;

    db.get('SELECT * FROM files WHERE id = ?', [fileId], (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (file.user_id !== userId && !isAdmin) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        db.get('SELECT token FROM share_tokens WHERE file_id = ?', [fileId], (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });

            if (existing) {
                const shareUrl = `${req.protocol}://${req.get('host')}/api/files/${fileId}/view?token=${existing.token}`;
                return res.json({ token: existing.token, shareUrl });
            }

            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');

            db.run('INSERT INTO share_tokens (file_id, token) VALUES (?, ?)', [fileId, token], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                const shareUrl = `${req.protocol}://${req.get('host')}/api/files/${fileId}/view?token=${token}`;
                res.json({ token, shareUrl });
            });
        });
    });
});

router.delete('/:id', requireAuth, (req, res) => {
    const userId = req.session.userId;
    const fileId = req.params.id;

    db.get('SELECT * FROM files WHERE id = ? AND user_id = ?', [fileId, userId], (err, file) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!file) return res.status(404).json({ error: 'File not found' });

        fs.unlink(file.path, (err) => {
            if (err) console.error('Failed to delete file from disk:', err);

            db.run('DELETE FROM files WHERE id = ?', [fileId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'File deleted successfully' });
            });
        });
    });
});

module.exports = router;
