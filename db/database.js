const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ======================================================
// Database location
// Local Development -> db/database.sqlite
// Railway Production -> /data/database.sqlite
// ======================================================

const dataDirectory = process.env.DATA_DIR || __dirname;

fs.mkdirSync(dataDirectory, { recursive: true });

const dbPath = path.join(dataDirectory, 'database.sqlite');

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`SQLite database: ${dbPath}`);

// ======================================================
// Create Tables
// ======================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    background_image TEXT
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    content TEXT,
    cover_image TEXT,
    video_url TEXT,
    status TEXT CHECK(status IN ('draft','published','scheduled')) NOT NULL DEFAULT 'draft',
    scheduled_for DATETIME,
    featured INTEGER DEFAULT 0,
    written_by TEXT,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quran_verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    text TEXT,
    surah_name TEXT,
    ayah_number INTEGER
  );
`);

const countVerses = db.prepare('SELECT COUNT(*) AS count FROM quran_verses').get();
if (countVerses.count === 0) {
  const insertVerse = db.prepare('INSERT INTO quran_verses (reference, text, surah_name, ayah_number) VALUES (?, ?, ?, ?)');
  insertVerse.run('65:3', 'And whoever relies upon Allah — then He is sufficient for him.', 'At-Talaq', 3);
  insertVerse.run('2:153', 'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.', 'Al-Baqarah', 153);
  insertVerse.run('94:6', 'Indeed, with hardship [will be] ease.', 'Ash-Sharh', 6);
}

try {
  db.exec('ALTER TABLE posts ADD COLUMN view_count INTEGER DEFAULT 0;');
} catch (e) {
  // Column already exists
}

// ==================================================================
// Default Settings
// ======================================================

const defaultSettings = {
  heading_featured: 'Featured',
  heading_categories: 'Explore by Category',
  heading_whispers: 'Whispers from Within',
  quran_verse:
    'And whoever relies upon Allah — then He is sufficient for him.',
  quran_ref: '— Quran 65:3',
  ambient_music_src:
    'https://framerusercontent.com/assets/s6Kcvm0lGpVdIimLMjrCJjPgd28.mp3',
  ambient_music_type: 'file'
};

const upsertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);

for (const [key, value] of Object.entries(defaultSettings)) {
  upsertSetting.run(key, value);
}

// ======================================================
// Seed Categories
// ======================================================

const countCategories = db
  .prepare('SELECT COUNT(*) AS count FROM categories')
  .get();

if (countCategories.count === 0) {
  const insertCategory = db.prepare(
    'INSERT INTO categories (name, slug, background_image) VALUES (?, ?, ?)'
  );

  insertCategory.run(
    'Tech',
    'tech',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80'
  );

  insertCategory.run(
    'World',
    'world',
    'https://images.unsplash.com/photo-1502951682449-e5b93545d8b5?w=800&q=80'
  );

  insertCategory.run(
    'College',
    'college',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80'
  );

  insertCategory.run(
    'Personal',
    'personal',
    'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80'
  );

  insertCategory.run(
    'Gazal',
    'gazal',
    'https://images.unsplash.com/photo-1513258496099-481663116df7?w=800&q=80'
  );
}

// ======================================================
// Seed Posts
// ======================================================

const countPosts = db
  .prepare('SELECT COUNT(*) AS count FROM posts')
  .get();

if (countPosts.count === 0) {
  const insertPost = db.prepare(`
    INSERT INTO posts (
      title,
      slug,
      category,
      description,
      content,
      cover_image,
      status,
      featured,
      written_by,
      published_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'published', ?, 'Faiz', datetime('now'))
  `);

  insertPost.run(
    'The Beauty of Solitude',
    'beauty-of-solitude',
    'personal',
    'Sometimes, the best company is yourself. A reflection on quiet moments.',
    '<p>In the rush of modern life, we often forget the profound peace that comes from simply being alone with our thoughts...</p>',
    'https://images.unsplash.com/photo-1444491741275-3747c53c99b4?w=800&q=80',
    1
  );

  insertPost.run(
    'Echoes of the Night',
    'echoes-of-the-night',
    'gazal',
    'A soft gazal exploring the depths of the midnight sky and the stars that listen.',
    '<p>The night speaks in whispers,<br>A language only the broken understand.<br>Stars listen to the silence,<br>While the moon holds my hand.</p>',
    'https://images.unsplash.com/photo-1505322022379-7c3353ee6291?w=800&q=80',
    1
  );

  insertPost.run(
    'Navigating the Tech Layoffs',
    'navigating-tech-layoffs',
    'tech',
    'Thoughts on the current state of the tech industry and how to stay resilient.',
    '<p>It has been a tumultuous year for tech. But amidst the chaos, there are always opportunities for those willing to adapt...</p>',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
    0
  );

  insertPost.run(
    'Campus Chronicles: Semester 4',
    'campus-chronicles-sem-4',
    'college',
    'Late night coffees, endless assignments, and the memories being made.',
    '<p>Semester 4 has been nothing short of a rollercoaster. Between the tough algorithms class and the spontaneous midnight road trips...</p>',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
    0
  );
}

// ======================================================
// Helper
// ======================================================

db.getSetting = (key) => {
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key);

  return row ? row.value : null;
};

module.exports = db;