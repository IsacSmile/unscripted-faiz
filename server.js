require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cron = require('node-cron');
const expressLayouts = require('express-ejs-layouts');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout'); 
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Provide local variables to all views
app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.admin = req.session.admin || false;
  try {
    res.locals.categories = db.prepare("SELECT * FROM categories ORDER BY name ASC").all();
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.locals.settings = settings;
  } catch (e) {
    res.locals.categories = [];
    res.locals.settings = {};
  }
  next();
});

// Routes
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

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
  res.status(404).render('404', { title: 'Page Not Found - UnscriptedFaiz' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
