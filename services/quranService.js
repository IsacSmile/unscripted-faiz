const db = require('../db/database');

/**
 * Fetch a verse from the public Quran API (en.sahih translation).
 * @param {string} reference e.g., "65:3"
 * @returns {Promise<{text: string, surahName: string, ayahNumber: number} | null>}
 */
async function fetchVerseFromAPI(reference) {
  try {
    const url = `https://api.alquran.cloud/v1/ayah/${reference}/en.sahih`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`[QuranAPI] Failed to fetch ${reference}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (data && data.code === 200 && data.data) {
      return {
        text: data.data.text,
        surahName: data.data.surah.englishName,
        ayahNumber: data.data.numberInSurah
      };
    }
  } catch (err) {
    console.error(`[QuranAPI Error] Failed to fetch ${reference}:`, err.message);
  }
  return null;
}

/**
 * Gets a random verse, fetches from API if not cached, and caches it.
 * Falls back gracefully to cached verses or a hardcoded default.
 */
async function getRandomVerse() {
  try {
    // 1. Get all verse references from the database
    const verses = db.prepare('SELECT * FROM quran_verses').all();
    if (verses.length === 0) {
      return {
        text: "And whoever relies upon Allah — then He is sufficient for him.",
        ref: "— Quran At-Talaq 65:3"
      };
    }

    // 2. Pick one at random
    const randomIndex = Math.floor(Math.random() * verses.length);
    const chosen = verses[randomIndex];

    // 3. If text is cached, return it immediately
    if (chosen.text) {
      return {
        text: chosen.text,
        ref: `— Quran ${chosen.surah_name} ${chosen.reference}`
      };
    }

    // 4. Not cached: Fetch from AlQuran API
    console.log(`[QuranService] Cache miss for reference: ${chosen.reference}. Fetching from API...`);
    const fetched = await fetchVerseFromAPI(chosen.reference);

    if (fetched) {
      // Cache it in the database
      db.prepare('UPDATE quran_verses SET text = ?, surah_name = ?, ayah_number = ? WHERE id = ?')
        .run(fetched.text, fetched.surahName, fetched.ayahNumber, chosen.id);
      
      return {
        text: fetched.text,
        ref: `— Quran ${fetched.surahName} ${chosen.reference}`
      };
    }

    // 5. Fallback: try to find any already-cached verse in the DB
    const cachedVerses = db.prepare('SELECT * FROM quran_verses WHERE text IS NOT NULL').all();
    if (cachedVerses.length > 0) {
      const fallbackIndex = Math.floor(Math.random() * cachedVerses.length);
      const fallback = cachedVerses[fallbackIndex];
      return {
        text: fallback.text,
        ref: `— Quran ${fallback.surah_name} ${fallback.reference}`
      };
    }

    // 6. Hard fallback if absolutely nothing has text
    return {
      text: "And whoever relies upon Allah — then He is sufficient for him.",
      ref: "— Quran At-Talaq 65:3"
    };

  } catch (err) {
    console.error('[QuranService Error]:', err);
    return {
      text: "And whoever relies upon Allah — then He is sufficient for him.",
      ref: "— Quran At-Talaq 65:3"
    };
  }
}

module.exports = {
  getRandomVerse,
  fetchVerseFromAPI
};
