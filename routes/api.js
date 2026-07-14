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

  let sql = "SELECT p.id, p.title, p.slug, p.category, p.description, p.cover_image, p.view_count, p.published_at, c.background_image AS category_image FROM posts p LEFT JOIN categories c ON p.category = c.slug WHERE p.status = 'published'";
  const params = [];

  if (q) {
    sql += ' AND (p.title LIKE ? OR p.description LIKE ?)';
    const lq = `%${q}%`;
    params.push(lq, lq);
  }
  if (category) {
    sql += ' AND p.category = ?';
    params.push(category);
  }

  sql += ' ORDER BY p.published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const posts = db.prepare(sql).all(...params);
  res.json({ posts });
});

// GET /api/search?q=… — live search (returns lightweight results)
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const category = req.query.category || '';
  if (!q && !category) return res.json({ posts: [], total: 0 });

  let sql = "SELECT p.id, p.title, p.slug, p.category, p.description, p.cover_image, p.view_count, p.published_at, c.background_image AS category_image FROM posts p LEFT JOIN categories c ON p.category = c.slug WHERE p.status = 'published'";
  const params = [];

  if (q) {
    sql += ' AND (p.title LIKE ? OR p.description LIKE ?)';
    const lq = `%${q}%`;
    params.push(lq, lq);
  }
  if (category) {
    sql += ' AND p.category = ?';
    params.push(category);
  }

  // Count for info strip
  let countSql = "SELECT COUNT(*) as count FROM posts p WHERE p.status = 'published'";
  const countParams = [];
  if (q) {
    countSql += ' AND (p.title LIKE ? OR p.description LIKE ?)';
    countParams.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    countSql += ' AND p.category = ?';
    countParams.push(category);
  }
  const total = db.prepare(countSql).get(...countParams).count;

  sql += ' ORDER BY p.published_at DESC LIMIT 18';
  const posts = db.prepare(sql).all(...params);
  res.json({ posts, total });
});

module.exports = router;
