const https = require('https');
const http = require('http');
const db = require('../db/database');

// Helper: Fetch URL content
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Handle redirect
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

// Helper: Parse XML elements using Regex
function extractTagContent(xmlString, tagName) {
  const regex = new RegExp(`<${tagName}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tagName}>`);
  const match = xmlString.match(regex);
  return match ? match[1].trim() : '';
}

// Helper: Create unique, URL-safe slug
function slugify(text) {
  let slug = text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  // Ensure slug uniqueness
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM posts WHERE slug = ?');
  let exists = checkStmt.get(slug).count > 0;
  if (exists) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return slug;
}

// Helper: Generate fallback summary if LLM key is absent or call fails
function generateFallbackSummary(title, description, sourceName) {
  return `According to a report by ${sourceName}, ${title}. 

The report details the following updates:
${description || 'No further description was provided in the source report.'}

This post is a digest summary of the developments reported. The original article and full details can be accessed directly via the citation link below.`;
}

// Generate summary via Google Gemini API
async function generateSummaryWithLLM(title, description, sourceName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[NewsDigest] GEMINI_API_KEY not found. Using local template fallback summary.');
    return generateFallbackSummary(title, description, sourceName);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{
          text: `You are an assistant summarizing news about Palestine developments for a personal blog called UnfilteredFaiz.
Generate a short, original summary blog post based on the following news article details:
Title: ${title}
Description: ${description}
Source: ${sourceName}

Guardrails:
1. Write 2-3 short, readable paragraphs in a thoughtful, clean, modern voice.
2. Stick strictly to the verifiable facts mentioned in the title/description.
3. Avoid speculation and do not editorialize or add strong opinions.
4. Clearly attribute claims to the source (e.g. "According to a report by ${sourceName}...").
5. Do NOT copy-paste the text of the source directly. Make it original.
6. Return only the post body in Markdown format. Do NOT include a title/heading (the title is handled separately).`
        }]
      }],
      generationConfig: {
        temperature: 0.2
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const text = data.contents?.[0]?.parts?.[0]?.text;
    if (text) {
      return text.trim();
    }
    throw new Error('Empty response content from Gemini API');
  } catch (e) {
    console.error('[NewsDigest] LLM call failed, falling back to local template:', e.message);
    return generateFallbackSummary(title, description, sourceName);
  }
}

// Core Pipeline Execution
async function runDigestPipeline() {
  console.log('[NewsDigest] Running automated news digest checks...');
  
  const feeds = [
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera' },
    { url: 'http://feeds.bbci.co.uk/news/world/middle_east/rss.xml', name: 'BBC News' }
  ];

  const keywords = [
    'palestine', 'gaza', 'west bank', 'ramallah', 'jerusalem', 'rafah', 
    'khan younis', 'al-aqsa', 'nablus', 'hebron', 'bethlehem', 'jenin', 'palestinian'
  ];

  let newDraftsCount = 0;

  for (const feed of feeds) {
    try {
      const xml = await fetchURL(feed.url);
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      
      while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];
        const title = extractTagContent(itemContent, 'title');
        const link = extractTagContent(itemContent, 'link');
        const description = extractTagContent(itemContent, 'description');
        
        if (!title || !link) continue;

        // Check keywords
        const checkText = `${title} ${description}`.toLowerCase();
        const matchesKeyword = keywords.some(kw => checkText.includes(kw));
        if (!matchesKeyword) continue;

        // Check duplicates
        const checkDup = db.prepare('SELECT COUNT(*) as count FROM processed_news_sources WHERE url = ?');
        if (checkDup.get(link).count > 0) continue;

        console.log(`[NewsDigest] Processing matching article: "${title}" from ${feed.name}`);

        // Generate summary
        const summary = await generateSummaryWithLLM(title, description, feed.name);
        
        // Append citation
        const finalContent = `${summary}\n\n---\n*via [${feed.name}](${link})*`;
        const slug = slugify(title);

        // Save as Draft
        const insertPost = db.prepare(`
          INSERT INTO posts (
            title, slug, category, description, content, cover_image, status, written_by, is_automated
          ) VALUES (?, ?, 'world', ?, ?, ?, 'draft', 'Auto-Digest', 1)
        `);

        // Use a generic clean news cover image
        const defaultCover = 'https://images.unsplash.com/photo-1495020689067-958852a6565d?w=800&q=80';
        
        insertPost.run(title, slug, description || title, finalContent, defaultCover);

        // Mark as processed
        db.prepare('INSERT INTO processed_news_sources (url, title) VALUES (?, ?)').run(link, title);
        
        newDraftsCount++;
      }
    } catch (err) {
      console.error(`[NewsDigest] Error processing feed ${feed.name}:`, err.message);
    }
  }

  if (newDraftsCount > 0) {
    console.log(`[NewsDigest] Successfully generated ${newDraftsCount} new automated digest draft(s).`);
  } else {
    console.log('[NewsDigest] No new matching news items detected.');
  }
}

module.exports = {
  runDigestPipeline
};
