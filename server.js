const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const cors = require('cors');
const db = require('./database'); // Ensure DB is initialized

const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 7529;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
    secret: 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
}));

// Request Logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Static Files
app.use(express.static(path.join(__dirname, 'public')));

// Explicit Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
    console.log(`Server running on http://127.0.0.1:${PORT}`);
});
