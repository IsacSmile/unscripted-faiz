const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/posts — paginated with search/category
router.get('/posts', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 18;
  const offset = (page - 1) * limit;
  const category = req.query.category || '';
  const q = req.query.q || '';

  let sql = "SELECT id, title, slug, category, description, cover_image, view_count, published_at FROM posts WHERE status = 'published'";
  const params = [];

  if (q) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    const lq = `%${q}%`;
    params.push(lq, lq);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const posts = db.prepare(sql).all(...params);
  res.json({ posts });
});

// GET /api/search?q=… — live search (returns lightweight results)
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const category = req.query.category || '';
  if (!q && !category) return res.json({ posts: [], total: 0 });

  let sql = "SELECT id, title, slug, category, description, cover_image, view_count, published_at FROM posts WHERE status = 'published'";
  const params = [];

  if (q) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    const lq = `%${q}%`;
    params.push(lq, lq);
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  // Count for info strip
  let countSql = sql.replace('SELECT id, title, slug, category, description, cover_image, published_at', 'SELECT COUNT(*) as count');
  const total = db.prepare(countSql).get(...params).count;

  sql += ' ORDER BY published_at DESC LIMIT 18';
  const posts = db.prepare(sql).all(...params);
  res.json({ posts, total });
});

module.exports = router;
