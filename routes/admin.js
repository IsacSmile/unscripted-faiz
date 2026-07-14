const express = require('express');
const router = express.Router();
const db = require('../db/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Upload directory ─────────────────────────────────────────
//
// Local development:
// public/uploads
//
// Railway production:
// /data/uploads
//
const uploadDirectory = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'uploads')
  : path.join(__dirname, '../public/uploads');

fs.mkdirSync(uploadDirectory, { recursive: true });

// ─── Auth middleware ──────────────────────────────────────────
const requireAuth = (req, res, next) => {
  if (req.session.admin) {
    return next();
  }

  return res.redirect('/admin');
};

// ─── Multer setup ─────────────────────────────────────────────
const allowedMimeTypes = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',

  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueFilename =
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(
        new Error(
          'Unsupported file type. Upload JPG, PNG, WebP, GIF, MP3, WAV, OGG, M4A, or MP4 audio.'
        )
      );
    }

    cb(null, true);
  }
});

// ─── Helpers ──────────────────────────────────────────────────
const generateSlug = (title = '') =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

// ─── Public Auth ──────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }

  return res.render('admin/login', {
    title: 'Admin Login',
    layout: 'admin/layout'
  });
});

router.post('/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect('/admin/dashboard');
  }

  return res.render('admin/login', {
    title: 'Admin Login',
    layout: 'admin/layout',
    error: 'Invalid password'
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Session logout error:', error);
    }

    res.redirect('/admin');
  });
});

router.use(requireAuth);

// ─── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const posts = db
    .prepare('SELECT * FROM posts ORDER BY created_at DESC')
    .all();

  res.render('admin/dashboard', {
    title: 'Dashboard',
    layout: 'admin/layout',
    posts
  });
});

// ─── Post Editor ──────────────────────────────────────────────
router.get('/new', (req, res) => {
  const categories = db
    .prepare('SELECT * FROM categories ORDER BY name ASC')
    .all();

  res.render('admin/editor', {
    title: 'New Post',
    layout: 'admin/layout',
    categories,
    post: {}
  });
});

router.get('/posts/:id/edit', (req, res) => {
  const post = db
    .prepare('SELECT * FROM posts WHERE id = ?')
    .get(req.params.id);

  const categories = db
    .prepare('SELECT * FROM categories ORDER BY name ASC')
    .all();

  if (!post) {
    return res.redirect('/admin/dashboard');
  }

  return res.render('admin/editor', {
    title: 'Edit Post',
    layout: 'admin/layout',
    categories,
    post
  });
});

router.post(
  '/posts',
  upload.single('cover_image_file'),
  (req, res) => {
    let {
      title,
      category,
      new_category,
      description,
      content,
      video_url,
      status,
      scheduled_for,
      featured,
      written_by,
      existing_cover
    } = req.body;

    if (new_category && new_category.trim()) {
      const categoryName = new_category.trim();
      const categorySlug = generateSlug(categoryName);

      try {
        db.prepare(`
          INSERT INTO categories (
            name,
            slug,
            background_image
          )
          VALUES (?, ?, ?)
        `).run(
          categoryName,
          categorySlug,
          'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80'
        );
      } catch (error) {
        // Category probably already exists.
      }

      category = categorySlug;
    } else if (!category) {
      category = 'uncategorized';
    }

    const slug = generateSlug(title);
    let coverImage = existing_cover || '';

    if (req.file) {
      coverImage = `/uploads/${req.file.filename}`;
    }

    featured = featured === 'on' ? 1 : 0;

    if (status === 'scheduled' && !scheduled_for) {
      status = 'draft';
    }

    const publishedAt =
      status === 'published'
        ? new Date().toISOString()
        : null;

    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO posts (
          title,
          slug,
          category,
          description,
          content,
          cover_image,
          video_url,
          status,
          scheduled_for,
          featured,
          written_by,
          created_at,
          updated_at,
          published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title,
        slug,
        category,
        description,
        content,
        coverImage,
        video_url,
        status,
        scheduled_for || null,
        featured,
        written_by || 'Faiz',
        now,
        now,
        publishedAt
      );

      return res.redirect('/admin/dashboard');
    } catch (error) {
      console.error('Error saving post:', error);
      return res.status(500).send('Error saving post');
    }
  }
);

router.post(
  '/posts/:id',
  upload.single('cover_image_file'),
  (req, res) => {
    let {
      title,
      category,
      new_category,
      description,
      content,
      video_url,
      status,
      scheduled_for,
      featured,
      written_by,
      existing_cover
    } = req.body;

    if (new_category && new_category.trim()) {
      const categoryName = new_category.trim();
      const categorySlug = generateSlug(categoryName);

      try {
        db.prepare(`
          INSERT INTO categories (
            name,
            slug,
            background_image
          )
          VALUES (?, ?, ?)
        `).run(
          categoryName,
          categorySlug,
          'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80'
        );
      } catch (error) {
        // Category probably already exists.
      }

      category = categorySlug;
    }

    let coverImage = existing_cover || '';

    if (req.file) {
      coverImage = `/uploads/${req.file.filename}`;
    }

    featured = featured === 'on' ? 1 : 0;

    const slug = generateSlug(title);

    const existingPost = db
      .prepare('SELECT * FROM posts WHERE id = ?')
      .get(req.params.id);

    if (!existingPost) {
      return res.redirect('/admin/dashboard');
    }

    const publishedAt =
      status === 'published' &&
        existingPost.status !== 'published'
        ? new Date().toISOString()
        : existingPost.published_at;

    try {
      db.prepare(`
        UPDATE posts
        SET
          title = ?,
          slug = ?,
          category = ?,
          description = ?,
          content = ?,
          cover_image = ?,
          video_url = ?,
          status = ?,
          scheduled_for = ?,
          featured = ?,
          written_by = ?,
          updated_at = ?,
          published_at = ?
        WHERE id = ?
      `).run(
        title,
        slug,
        category,
        description,
        content,
        coverImage,
        video_url,
        status,
        scheduled_for || null,
        featured,
        written_by || 'Faiz',
        new Date().toISOString(),
        publishedAt,
        req.params.id
      );

      return res.redirect('/admin/dashboard');
    } catch (error) {
      console.error('Error updating post:', error);
      return res.status(500).send('Error updating post');
    }
  }
);

router.post('/posts/:id/delete', (req, res) => {
  try {
    db.prepare('DELETE FROM posts WHERE id = ?')
      .run(req.params.id);

    return res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).send('Error deleting post');
  }
});

// ─── Category Management ──────────────────────────────────────
router.get('/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT
      c.*,
      COUNT(p.id) AS post_count
    FROM categories c
    LEFT JOIN posts p
      ON p.category = c.slug
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();

  res.render('admin/categories', {
    title: 'Categories',
    layout: 'admin/layout',
    categories
  });
});

router.post(
  '/categories',
  upload.single('bg_image_file'),
  (req, res) => {
    const { name, bg_image_url } = req.body;
    const slug = generateSlug(name);

    let backgroundImage =
      bg_image_url ||
      'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&q=80';

    if (req.file) {
      backgroundImage = `/uploads/${req.file.filename}`;
    }

    try {
      db.prepare(`
        INSERT INTO categories (
          name,
          slug,
          background_image
        )
        VALUES (?, ?, ?)
      `).run(name, slug, backgroundImage);
    } catch (error) {
      console.error('Error creating category:', error.message);
    }

    res.redirect('/admin/categories');
  }
);

router.post(
  '/categories/:id/edit',
  upload.single('bg_image_file'),
  (req, res) => {
    const {
      name,
      bg_image_url,
      existing_bg
    } = req.body;

    const backgroundImage = req.file
      ? `/uploads/${req.file.filename}`
      : bg_image_url || existing_bg || '';

    try {
      db.prepare(`
        UPDATE categories
        SET
          name = ?,
          background_image = ?
        WHERE id = ?
      `).run(
        name,
        backgroundImage,
        req.params.id
      );

      res.redirect('/admin/categories');
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).send('Error updating category');
    }
  }
);

router.post('/categories/:id/delete', (req, res) => {
  try {
    const category = db
      .prepare('SELECT slug FROM categories WHERE id = ?')
      .get(req.params.id);

    if (category) {
      db.prepare(`
        UPDATE posts
        SET category = 'uncategorized'
        WHERE category = ?
      `).run(category.slug);

      db.prepare('DELETE FROM categories WHERE id = ?')
        .run(req.params.id);
    }

    res.redirect('/admin/categories');
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).send('Error deleting category');
  }
});

// ─── Settings ─────────────────────────────────────────────────
router.get('/settings', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM settings')
    .all();

  const settings = {};

  rows.forEach((row) => {
    settings[row.key] = row.value;
  });

  const verses = db.prepare('SELECT * FROM quran_verses').all();

  res.render('admin/settings', {
    title: 'Settings',
    layout: 'admin/layout',
    settings,
    verses
  });
});

router.post(
  '/settings',
  upload.fields([
    { name: 'audio_file', maxCount: 1 },
    { name: 'hero_image_file', maxCount: 1 }
  ]),
  (req, res) => {
    const allowedSettings = [
      'heading_featured',
      'heading_categories',
      'heading_whispers',
      'quran_verse',
      'quran_ref',
      'hero_desc'
    ];

    const upsert = db.prepare(`
      INSERT OR REPLACE INTO settings (
        key,
        value
      )
      VALUES (?, ?)
    `);

    allowedSettings.forEach((key) => {
      if (req.body[key] !== undefined) {
        upsert.run(key, req.body[key]);
      }
    });

    // Handle audio file
    if (req.body.clear_music === 'true') {
      upsert.run(
        'ambient_music_src',
        'https://framerusercontent.com/assets/s6Kcvm0lGpVdIimLMjrCJjPgd28.mp3'
      );
      upsert.run('ambient_music_type', 'file');
    } else if (req.files && req.files.audio_file && req.files.audio_file[0]) {
      const filePath = `/uploads/${req.files.audio_file[0].filename}`;
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

    // Handle hero image file
    if (req.body.clear_hero_image === 'true') {
      upsert.run('hero_image', '');
    } else if (req.files && req.files.hero_image_file && req.files.hero_image_file[0]) {
      const filePath = `/uploads/${req.files.hero_image_file[0].filename}`;
      upsert.run('hero_image', filePath);
    }

    res.redirect('/admin/settings');
  }
);

router.post('/settings/verses/add', (req, res) => {
  const { reference } = req.body;
  if (reference && reference.trim()) {
    const ref = reference.trim();
    const refPattern = /^\d+:\d+(-\d+)?$/;
    if (refPattern.test(ref)) {
      try {
        db.prepare('INSERT INTO quran_verses (reference) VALUES (?)').run(ref);
      } catch (err) {
        console.error('Failed to add verse reference:', err.message);
      }
    }
  }
  res.redirect('/admin/settings#quran-verses-section');
});

router.post('/settings/verses/:id/update', (req, res) => {
  const { action, reference, text } = req.body;
  const id = req.params.id;

  if (action === 'delete') {
    db.prepare('DELETE FROM quran_verses WHERE id = ?').run(id);
  } else {
    const ref = reference ? reference.trim() : '';
    const txt = text ? text.trim() : null;
    const refPattern = /^\d+:\d+(-\d+)?$/;
    
    if (ref && refPattern.test(ref)) {
      try {
        if (txt === '') {
          db.prepare('UPDATE quran_verses SET reference = ?, text = NULL, surah_name = NULL, ayah_number = NULL WHERE id = ?').run(ref, id);
        } else {
          db.prepare('UPDATE quran_verses SET reference = ?, text = ? WHERE id = ?').run(ref, txt, id);
        }
      } catch (err) {
        console.error('Failed to update verse:', err.message);
      }
    }
  }
  res.redirect('/admin/settings#quran-verses-section');
});

// ─── Upload error handler ─────────────────────────────────────
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res
        .status(400)
        .send('File is too large. Maximum file size is 10 MB.');
    }

    return res
      .status(400)
      .send(`Upload error: ${error.message}`);
  }

  if (error) {
    console.error('Admin route error:', error);
    return res
      .status(400)
      .send(error.message || 'Unable to process request.');
  }

  next();
});

// ─── Comment Moderation ─────────────────────────────────────────
router.get('/comments', (req, res) => {
  const comments = db.prepare(`
    SELECT c.*, p.title as post_title, p.slug as post_slug 
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    ORDER BY c.created_at DESC
  `).all();

  res.render('admin/comments', {
    title: 'Comments Moderation',
    layout: 'admin/layout',
    comments
  });
});

router.post('/comments/:id/delete', (req, res) => {
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.redirect('/admin/comments');
});

module.exports = router;