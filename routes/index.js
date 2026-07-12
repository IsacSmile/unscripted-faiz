const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { format } = require('date-fns');

// Helper to get featured posts
const getFeatured = () => {
  return db.prepare("SELECT * FROM posts WHERE status = 'published' AND featured = 1 ORDER BY published_at DESC").all();
};

// Helper to get categories
const getCategories = () => {
  return db.prepare("SELECT * FROM categories ORDER BY name ASC").all();
};

router.get('/', (req, res) => {
  res.redirect('/home');
});

router.get('/home', (req, res) => {
  const featuredPosts = getFeatured();
  const categoriesRaw = getCategories();
  const latestPosts = db.prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 18").all();

  // Attach post counts to categories
  const categories = categoriesRaw.map(cat => ({
    ...cat,
    post_count: db.prepare("SELECT COUNT(*) as c FROM posts WHERE status='published' AND category=?").get(cat.slug).c
  }));

  res.render('home', {
    title: 'UnscriptedFaiz — Whispers from Within',
    featuredPosts,
    categories,
    latestPosts
  });
});


router.get('/blog', (req, res) => {
  const categories = getCategories();
  const query = req.query.q || '';
  const categoryFilter = req.query.category || '';
  
  // We don't fetch all posts immediately, we let the client fetch them or we fetch first 18 based on filters
  let sql = "SELECT * FROM posts WHERE status = 'published'";
  const params = [];
  
  if (query) {
    sql += " AND (title LIKE ? OR description LIKE ? OR content LIKE ?)";
    const likeQuery = `%${query}%`;
    params.push(likeQuery, likeQuery, likeQuery);
  }
  
  if (categoryFilter) {
    sql += " AND category = ?";
    params.push(categoryFilter);
  }
  
  sql += " ORDER BY published_at DESC LIMIT 18";
  
  const posts = db.prepare(sql).all(...params);

  // Total count (without limit) for info strip
  let countSql = "SELECT COUNT(*) as count FROM posts WHERE status = 'published'";
  const countParams = [];
  if (query) {
    countSql += " AND (title LIKE ? OR description LIKE ? OR content LIKE ?)";
    const lq = `%${query}%`;
    countParams.push(lq, lq, lq);
  }
  if (categoryFilter) {
    countSql += " AND category = ?";
    countParams.push(categoryFilter);
  }
  const totalCount = db.prepare(countSql).get(...countParams).count;

  res.render('blog', {
    title: 'Blog - UnscriptedFaiz',
    posts,
    categories,
    query,
    categoryFilter,
    totalCount
  });
});


router.get('/blog/:slug', (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published'").get(req.params.slug);
  
  if (!post) {
    return res.status(404).render('404', { title: 'Post Not Found - UnscriptedFaiz' });
  }
  
  const comments = db.prepare("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC").all(post.id);
  
  res.render('post', {
    title: `${post.title} - UnscriptedFaiz`,
    post,
    comments,
    format
  });
});

router.post('/blog/:slug/comment', (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(req.params.slug);
  if (!post) return res.status(404).send('Not found');
  
  const { name, comment } = req.body;
  if (name && comment) {
    const insert = db.prepare("INSERT INTO comments (post_id, name, comment) VALUES (?, ?, ?)");
    insert.run(post.id, name, comment);
  }
  
  res.redirect(`/blog/${req.params.slug}`);
});

// RSS Feed
router.get('/rss.xml', (req, res) => {
  const posts = db.prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 20").all();
  
  let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>UnscriptedFaiz</title>
  <description>Whispers from Within</description>
  <link>http://${req.headers.host}</link>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
`;

  posts.forEach(post => {
    rss += `
  <item>
    <title><![CDATA[${post.title}]]></title>
    <description><![CDATA[${post.description}]]></description>
    <link>http://${req.headers.host}/blog/${post.slug}</link>
    <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
  </item>`;
  });

  rss += `
</channel>
</rss>`;

  res.set('Content-Type', 'text/xml');
  res.send(rss);
});

module.exports = router;
