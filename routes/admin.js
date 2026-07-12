const express = require('express');
const router = express.Router();
const db = require('../db/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.admin) return next();
  res.redirect('/admin');
};

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const generateSlug = (title) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

// ─── Public Auth ──────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session.admin) return res.redirect('/admin/dashboard');
  res.render('admin/login', { title: 'Admin Login', layout: 'admin/layout' });
});

router.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin/login', { title: 'Admin Login', layout: 'admin/layout', error: 'Invalid password' });
  }
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/admin'); });

router.use(requireAuth);

// ─── Dashboard ───────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  res.render('admin/dashboard', { title: 'Dashboard', layout: 'admin/layout', posts });
});

// ─── Post Editor ─────────────────────────────────────────────
router.get('/new', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.render('admin/editor', { title: 'New Post', layout: 'admin/layout', categories, post: {} });
});

router.get('/posts/:id/edit', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  if (!post) return res.redirect('/admin/dashboard');
  res.render('admin/editor', { title: 'Edit Post', layout: 'admin/layout', categories, post });
});

router.post('/posts', upload.single('cover_image_file'), (req, res) => {
  let { title, category, new_category, description, content, video_url, status, scheduled_for, featured, written_by, existing_cover } = req.body;
  if (new_category && new_category.trim()) {
    const catSlug = generateSlug(new_category);
    try { db.prepare('INSERT INTO categories (name, slug, background_image) VALUES (?, ?, ?)').run(new_category, catSlug, 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80'); } catch (e) {}
    category = catSlug;
  } else if (!category) category = 'uncategorized';

  const slug = generateSlug(title);
  let cover_image = existing_cover || '';
  if (req.file) cover_image = '/uploads/' + req.file.filename;
  featured = featured === 'on' ? 1 : 0;
  if (status === 'scheduled' && !scheduled_for) status = 'draft';
  const published_at = status === 'published' ? new Date().toISOString() : null;
  const now = new Date().toISOString();

  try {
    db.prepare(`INSERT INTO posts (title, slug, category, description, content, cover_image, video_url, status, scheduled_for, featured, written_by, created_at, updated_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(title, slug, category, description, content, cover_image, video_url, status, scheduled_for || null, featured, written_by || 'Faiz', now, now, published_at);
    res.redirect('/admin/dashboard');
  } catch (err) { console.error(err); res.status(500).send('Error saving post'); }
});

router.post('/posts/:id', upload.single('cover_image_file'), (req, res) => {
  let { title, category, new_category, description, content, video_url, status, scheduled_for, featured, written_by, existing_cover } = req.body;
  if (new_category && new_category.trim()) {
    const catSlug = generateSlug(new_category);
    try { db.prepare('INSERT INTO categories (name, slug, background_image) VALUES (?, ?, ?)').run(new_category, catSlug, 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80'); } catch (e) {}
    category = catSlug;
  }

  let cover_image = existing_cover || '';
  if (req.file) cover_image = '/uploads/' + req.file.filename;
  featured = featured === 'on' ? 1 : 0;
  const slug = generateSlug(title);
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  const published_at = status === 'published' && existing.status !== 'published' ? new Date().toISOString() : existing.published_at;

  try {
    db.prepare(`UPDATE posts SET title=?, slug=?, category=?, description=?, content=?, cover_image=?, video_url=?, status=?, scheduled_for=?, featured=?, written_by=?, updated_at=?, published_at=? WHERE id=?`)
      .run(title, slug, category, description, content, cover_image, video_url, status, scheduled_for || null, featured, written_by || 'Faiz', new Date().toISOString(), published_at, req.params.id);
    res.redirect('/admin/dashboard');
  } catch (err) { console.error(err); res.status(500).send('Error updating post'); }
});

router.post('/posts/:id/delete', (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.redirect('/admin/dashboard');
});

// ─── Category Management ──────────────────────────────────────
router.get('/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as post_count
    FROM categories c
    LEFT JOIN posts p ON p.category = c.slug
    GROUP BY c.id ORDER BY c.name ASC
  `).all();
  res.render('admin/categories', { title: 'Categories', layout: 'admin/layout', categories });
});

router.post('/categories', upload.single('bg_image_file'), (req, res) => {
  const { name, bg_image_url } = req.body;
  const slug = generateSlug(name);
  let bg = bg_image_url || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80';
  if (req.file) bg = '/uploads/' + req.file.filename;
  try {
    db.prepare('INSERT INTO categories (name, slug, background_image) VALUES (?, ?, ?)').run(name, slug, bg);
  } catch (e) { /* slug conflict */ }
  res.redirect('/admin/categories');
});

router.post('/categories/:id/edit', upload.single('bg_image_file'), (req, res) => {
  const { name, bg_image_url, existing_bg } = req.body;
  let bg = req.file ? '/uploads/' + req.file.filename : (bg_image_url || existing_bg || '');
  db.prepare('UPDATE categories SET name=?, background_image=? WHERE id=?').run(name, bg, req.params.id);
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', (req, res) => {
  const cat = db.prepare('SELECT slug FROM categories WHERE id = ?').get(req.params.id);
  if (cat) {
    db.prepare("UPDATE posts SET category = 'uncategorized' WHERE category = ?").run(cat.slug);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  }
  res.redirect('/admin/categories');
});

// ─── Settings (section headings, Quran verse, ambient music) ────────────────
router.get('/settings', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.render('admin/settings', { title: 'Settings', layout: 'admin/layout', settings });
});

router.post('/settings', requireAuth, upload.single('audio_file'), (req, res) => {
  const allowed = ['heading_featured', 'heading_categories', 'heading_whispers', 'quran_verse', 'quran_ref'];
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  
  // Save text settings
  allowed.forEach(k => {
    if (req.body[k] !== undefined) {
      upsert.run(k, req.body[k]);
    }
  });

  // Handle ambient music settings
  if (req.body.clear_music === 'true') {
    upsert.run('ambient_music_src', 'https://framerusercontent.com/assets/s6Kcvm0lGpVdIimLMjrCJjPgd28.mp3');
    upsert.run('ambient_music_type', 'file');
  } else if (req.file) {
    // If a file is uploaded
    const filePath = '/uploads/' + req.file.filename;
    upsert.run('ambient_music_src', filePath);
    upsert.run('ambient_music_type', 'file');
  } else if (req.body.ambient_music_src_url) {
    const url = req.body.ambient_music_src_url.trim();
    upsert.run('ambient_music_src', url);
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      upsert.run('ambient_music_type', 'youtube');
    } else {
      upsert.run('ambient_music_type', 'file');
    }
  }

  res.redirect('/admin/settings');
});

module.exports = router;
