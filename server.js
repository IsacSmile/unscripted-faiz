require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const expressLayouts = require('express-ejs-layouts');
const db = require('./db/database');
const { getRandomVerse } = require('./services/quranService');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);



// ======================================================
// Middleware
// ======================================================

app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
const uploadDirectory = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, 'public/uploads');

fs.mkdirSync(uploadDirectory, { recursive: true });

app.use('/uploads', express.static(uploadDirectory));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

// ======================================================
// Global variables for all views
// ======================================================

app.use(async (req, res, next) => {
  res.locals.path = req.path;
  res.locals.admin = req.session.admin || false;

  try {
    res.locals.categories = db
      .prepare('SELECT * FROM categories ORDER BY name ASC')
      .all();

    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};

    rows.forEach((row) => {
      settings[row.key] = row.value;
    });

    res.locals.settings = settings;

    // Get dynamic rotating Quran verse
    const verse = await getRandomVerse();
    res.locals.quran_verse = verse.text;
    res.locals.quran_ref = verse.ref;
  } catch (err) {
    console.error(err);
    res.locals.categories = [];
    res.locals.settings = {};
    res.locals.quran_verse = 'And whoever relies upon Allah — then He is sufficient for him.';
    res.locals.quran_ref = '— Quran At-Talaq 65:3';
  }

  next();
});

// ======================================================
// Routes
// ======================================================

const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

// ======================================================
// Health Check
// ======================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});





// Routes




// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});


app.use('/', indexRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// Cron Job for scheduled posts (Runs every minute)
cron.schedule('* * * * *', () => {
  const now = new Date().toISOString();
  // Find scheduled posts that should be published
  const publishStmt = db.prepare(`
    UPDATE posts 
    SET status = 'published', published_at = ? 
    WHERE status = 'scheduled' AND scheduled_for <= ?
  `);
  const result = publishStmt.run(now, now);
  if (result.changes > 0) {
    console.log(`Published ${result.changes} scheduled post(s) at ${now}`);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found - UnfilteredFaiz' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
