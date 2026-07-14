const db = require('../db/database');

/**
 * Clean up text and count words (ignoring punctuation).
 * @param {string} str 
 * @returns {number}
 */
function countWords(str) {
  if (!str) return 0;
  // Replace punctuation with spaces, then split by whitespace
  const cleaned = str.replace(/[—\-_.,\/#!$%\^&\*;:{}=\+`~()?"']/g, " ");
  return cleaned.trim().split(/\s+/).filter(Boolean).length;
}

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
 * Gets a random verse that satisfies the length constraint of 5-15 words.
 * Fetches from API if not cached, and caches it.
 * Falls back gracefully to cached verses or a hardcoded default.
 */
async function getRandomVerse() {
  const defaultVerse = {
    text: "And whoever relies upon Allah — then He is sufficient for him.",
    ref: "— Quran At-Talaq 65:3"
  };

  try {
    // 1. Get all verse references from the database
    const verses = db.prepare('SELECT * FROM quran_verses').all();
    if (verses.length === 0) {
      return defaultVerse;
    }

    // 2. Shuffle references to try them in a random order
    const shuffled = [...verses].sort(() => Math.random() - 0.5);

    // 3. Find the first verse that meets the length constraint (5-15 words)
    for (const chosen of shuffled) {
      if (chosen.text) {
        // Cached case
        const words = countWords(chosen.text);
        if (words >= 5 && words <= 15) {
          return {
            text: chosen.text,
            ref: `— Quran ${chosen.surah_name} ${chosen.reference}`
          };
        }
        console.log(`[QuranService] Skipping cached reference ${chosen.reference}: word count ${words} is outside 5-15 limit.`);
      } else {
        // Not cached case: Fetch from API
        console.log(`[QuranService] Cache miss for reference: ${chosen.reference}. Fetching from API...`);
        const fetched = await fetchVerseFromAPI(chosen.reference);

        if (fetched) {
          // Always cache the result in the database to prevent future redundant API hits
          db.prepare('UPDATE quran_verses SET text = ?, surah_name = ?, ayah_number = ? WHERE id = ?')
            .run(fetched.text, fetched.surahName, fetched.ayahNumber, chosen.id);

          const words = countWords(fetched.text);
          if (words >= 5 && words <= 15) {
            return {
              text: fetched.text,
              ref: `— Quran ${fetched.surahName} ${chosen.reference}`
            };
          }
          console.log(`[QuranService] Fetched reference ${chosen.reference} has ${words} words (outside 5-15 limit). Cached but skipping.`);
        }
      }
    }

    // 4. Fallback: try to find any already-cached verse in the DB that fits the constraint
    const cachedVerses = db.prepare('SELECT * FROM quran_verses WHERE text IS NOT NULL').all();
    const validCached = cachedVerses.filter(v => {
      const words = countWords(v.text);
      return words >= 5 && words <= 15;
    });

    if (validCached.length > 0) {
      const fallbackIndex = Math.floor(Math.random() * validCached.length);
      const fallback = validCached[fallbackIndex];
      return {
        text: fallback.text,
        ref: `— Quran ${fallback.surah_name} ${fallback.reference}`
      };
    }

    // 5. Hard fallback
    return defaultVerse;

  } catch (err) {
    console.error('[QuranService Error]:', err);
    return defaultVerse;
  }
}

module.exports = {
  getRandomVerse,
  fetchVerseFromAPI,
  countWords
};
