// scripts/scrape-quizlet-import.mjs
// Scrape từ vựng từ Quizlet rồi so sánh với Firestore và import từ còn thiếu
// Chạy: node scripts/scrape-quizlet-import.mjs

import puppeteer from "puppeteer";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  where,
} from "firebase/firestore";
import { readFileSync } from "fs";

// Load env
const envPath = ".env.local";
const envContent = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ===== STEP 1: SCRAPE QUIZLET =====
async function scrapeQuizlet(url) {
  console.log("🌐 Mở trình duyệt để scrape Quizlet...");
  const browser = await puppeteer.launch({
    headless: false, // Mở trình duyệt để bypass Cloudflare
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  // Remove webdriver flag
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  console.log(`📂 Đang mở: ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for cards to load
  await new Promise(r => setTimeout(r, 3000));

  // Try to close any cookie/login popup
  try {
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 1000));
  } catch {}

  // Scroll to bottom to load all cards
  console.log("📜 Đang cuộn trang để tải tất cả thẻ...");
  let prevHeight = 0;
  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await new Promise(r => setTimeout(r, 500));
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === prevHeight) break;
    prevHeight = currentHeight;
  }

  await new Promise(r => setTimeout(r, 2000));

  // Extract flashcard terms and definitions
  const cards = await page.evaluate(() => {
    const results = [];

    // Try multiple selectors Quizlet uses
    // Selector 1: .SetPageTerms-term
    const termRows = document.querySelectorAll('[class*="SetPageTerms-term"]');
    if (termRows.length > 0) {
      termRows.forEach(row => {
        const termEl = row.querySelector('[class*="TermText"]');
        const defEl = row.querySelectorAll('[class*="TermText"]')[1];
        if (termEl && defEl) {
          results.push({
            word: termEl.textContent.trim(),
            meaning: defEl.textContent.trim(),
          });
        }
      });
    }

    // Selector 2: .flashcard-content or data-testid
    if (results.length === 0) {
      const items = document.querySelectorAll('[data-testid="set-page-card-side"]');
      for (let i = 0; i < items.length; i += 2) {
        const word = items[i]?.textContent?.trim();
        const meaning = items[i + 1]?.textContent?.trim();
        if (word && meaning) results.push({ word, meaning });
      }
    }

    // Selector 3: General term/definition pairs
    if (results.length === 0) {
      const terms = document.querySelectorAll('.term');
      const defs = document.querySelectorAll('.definition');
      for (let i = 0; i < Math.min(terms.length, defs.length); i++) {
        results.push({
          word: terms[i].textContent.trim(),
          meaning: defs[i].textContent.trim(),
        });
      }
    }

    // Selector 4: Look for any structured card list
    if (results.length === 0) {
      const rows = document.querySelectorAll('.row, [class*="CardSide"], [class*="card-side"]');
      const pairs = [];
      rows.forEach(r => {
        const text = r.textContent.trim();
        if (text) pairs.push(text);
      });
      for (let i = 0; i < pairs.length; i += 2) {
        if (pairs[i] && pairs[i+1]) {
          results.push({ word: pairs[i], meaning: pairs[i+1] });
        }
      }
    }

    return results;
  });

  await browser.close();
  console.log(`✅ Scrape xong: ${cards.length} thẻ`);
  return cards;
}

// ===== STEP 2: GET EXISTING VOCABULARY FROM FIRESTORE =====
async function getExistingVocab() {
  console.log("📡 Đang lấy từ vựng hiện có từ Firestore...");
  const snap = await getDocs(collection(db, "vocabulary"));
  const existing = new Set();
  const existingWords = [];
  snap.forEach(doc => {
    const data = doc.data();
    existing.add(data.word);
    existingWords.push(data.word);
  });
  console.log(`📚 Hiện có: ${existing.size} từ trong Firestore`);
  return existing;
}

// ===== STEP 3: IMPORT MISSING WORDS =====
async function importMissing(quizletCards, existingWords) {
  const missing = quizletCards.filter(card => !existingWords.has(card.word));
  console.log(`\n🔍 Kết quả:`);
  console.log(`  - Quizlet có: ${quizletCards.length} từ`);
  console.log(`  - Firestore có: ${existingWords.size} từ`);
  console.log(`  - Trùng: ${quizletCards.length - missing.length} từ`);
  console.log(`  - Cần thêm: ${missing.length} từ`);

  if (missing.length === 0) {
    console.log("✅ Tất cả từ đã có rồi, không cần thêm gì.");
    return;
  }

  console.log("\n📝 Danh sách từ sẽ thêm:");
  missing.forEach((m, i) => console.log(`  ${i+1}. ${m.word} — ${m.meaning}`));

  console.log("\n⬆️ Đang import...");
  let added = 0;
  for (const card of missing) {
    // Parse reading from word if it contains furigana format
    let word = card.word;
    let meaning = card.meaning;
    let reading = "";

    // Clean up: some quizlet entries have format "word（reading）"
    const readingMatch = word.match(/^(.+?)[\s（(]([ぁ-ん]+)[)）]?\s*$/);
    if (readingMatch) {
      word = readingMatch[1].trim();
      reading = readingMatch[2].trim();
    } else {
      // If word is all kana, reading = word
      if (/^[ぁ-ん]+$/.test(word) || /^[ァ-ン]+$/.test(word)) {
        reading = word;
      }
    }

    await addDoc(collection(db, "vocabulary"), {
      word,
      reading: reading || word,
      meaning,
      type: "N",
      level: "N5",
      example: "",
      exampleMeaning: "",
    });
    added++;
    process.stdout.write(`\r  Đã thêm: ${added}/${missing.length}`);
  }

  console.log(`\n\n🎉 Hoàn thành! Đã thêm ${added} từ mới vào Firestore.`);
}

// ===== MAIN =====
const URL = "https://quizlet.com/vn/132683022/tu-vung-n5-flash-cards/";

try {
  const [quizletCards, existingWords] = await Promise.all([
    scrapeQuizlet(URL),
    getExistingVocab(),
  ]);

  if (quizletCards.length === 0) {
    console.error("❌ Không scrape được thẻ nào. Quizlet có thể đã chặn.");
    process.exit(1);
  }

  await importMissing(quizletCards, existingWords);
} catch (err) {
  console.error("❌ Lỗi:", err.message);
  process.exit(1);
}
