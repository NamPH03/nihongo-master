// scripts/scrape-quizlet-v2.mjs
// Phiên bản cải tiến: chụp ảnh debug + đợi lâu hơn + tìm tất cả selector có thể

import puppeteer from "puppeteer";
import { writeFileSync } from "fs";

async function scrapeQuizlet(url) {
  console.log("🌐 Mở trình duyệt...");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  });

  const page = await browser.newPage();

  // Giả lập trình duyệt thật
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
  });

  console.log(`📂 Đang mở: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    console.log("Timeout khi tải trang, tiếp tục...");
  }

  // Đợi 8 giây để trang load hoàn toàn
  console.log("⏳ Đợi trang render (8 giây)...");
  await new Promise(r => setTimeout(r, 8000));

  // Chụp ảnh debug
  await page.screenshot({ path: "scripts/quizlet-debug.png", fullPage: false });
  console.log("📸 Đã chụp ảnh debug: scripts/quizlet-debug.png");

  // Scroll từ từ
  console.log("📜 Đang cuộn trang...");
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 300));
  }
  await new Promise(r => setTimeout(r, 2000));

  // Lấy toàn bộ HTML để debug
  const html = await page.content();
  writeFileSync("scripts/quizlet-debug.html", html.substring(0, 50000));
  console.log("💾 Đã lưu HTML debug: scripts/quizlet-debug.html (50KB đầu)");

  // Thử mọi selector có thể
  const cards = await page.evaluate(() => {
    const results = [];
    const tried = [];

    // Selector 1: TermText
    const termTexts = document.querySelectorAll('[class*="TermText"]');
    tried.push(`TermText: ${termTexts.length}`);
    if (termTexts.length >= 2) {
      for (let i = 0; i < termTexts.length - 1; i += 2) {
        results.push({
          word: termTexts[i].textContent.trim(),
          meaning: termTexts[i + 1].textContent.trim(),
        });
      }
      return { results, tried };
    }

    // Selector 2: data-testid card-side
    const cardSides = document.querySelectorAll('[data-testid="card-side"]');
    tried.push(`card-side: ${cardSides.length}`);
    if (cardSides.length >= 2) {
      for (let i = 0; i < cardSides.length - 1; i += 2) {
        results.push({
          word: cardSides[i].textContent.trim(),
          meaning: cardSides[i + 1].textContent.trim(),
        });
      }
      return { results, tried };
    }

    // Selector 3: SetPageTerms
    const setTerms = document.querySelectorAll('[class*="SetPageTerms"]');
    tried.push(`SetPageTerms: ${setTerms.length}`);

    // Selector 4: any element with class containing "term"
    const anyTerms = document.querySelectorAll('[class*="term"]:not(script):not(style)');
    tried.push(`*term*: ${anyTerms.length}`);

    // Selector 5: data-testid set-page-card
    const setCards = document.querySelectorAll('[data-testid*="set-page"]');
    tried.push(`set-page*: ${setCards.length}`);

    // Selector 6: Look for Japanese text (Unicode range for kanji/kana)
    const allText = document.querySelectorAll('*');
    const japaneseEls = [];
    allText.forEach(el => {
      if (el.children.length === 0) { // leaf nodes only
        const text = el.textContent.trim();
        if (text.length > 0 && text.length < 100 && /[\u3040-\u30FF\u4E00-\u9FAF]/.test(text)) {
          japaneseEls.push(el);
        }
      }
    });
    tried.push(`Japanese text elements: ${japaneseEls.length}`);

    // Selector 7: __NEXT_DATA__ JSON
    const nextDataEl = document.getElementById("__NEXT_DATA__");
    tried.push(`__NEXT_DATA__: ${nextDataEl ? "found" : "not found"}`);

    return { results, tried, japaneseCount: japaneseEls.length };
  });

  console.log("\n🔍 Kết quả tìm selector:");
  cards.tried.forEach(t => console.log(`  - ${t}`));
  console.log(`\n📋 Tổng thẻ tìm được: ${cards.results?.length || 0}`);

  // Thử extract từ __NEXT_DATA__
  if (cards.results?.length === 0) {
    console.log("\n🔄 Thử extract từ __NEXT_DATA__ JSON...");
    const nextData = await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__");
      return el ? el.textContent : null;
    });

    if (nextData) {
      try {
        const parsed = JSON.parse(nextData);
        const jsonStr = JSON.stringify(parsed);
        writeFileSync("scripts/quizlet-nextdata.json", jsonStr.substring(0, 100000));
        console.log("💾 Đã lưu __NEXT_DATA__: scripts/quizlet-nextdata.json");
        
        // Tìm terms trong JSON
        function findTerms(obj, depth = 0) {
          if (depth > 10 || !obj) return [];
          const found = [];
          if (Array.isArray(obj)) {
            obj.forEach(item => found.push(...findTerms(item, depth + 1)));
          } else if (typeof obj === "object") {
            if (obj.word !== undefined && obj.definition !== undefined) {
              found.push({ word: String(obj.word), meaning: String(obj.definition) });
            }
            if (obj.term !== undefined && obj.definition !== undefined) {
              found.push({ word: String(obj.term), meaning: String(obj.definition) });
            }
            Object.values(obj).forEach(v => found.push(...findTerms(v, depth + 1)));
          }
          return found;
        }
        
        const termsFromJson = findTerms(parsed);
        console.log(`  Tìm được ${termsFromJson.length} từ từ __NEXT_DATA__`);
        if (termsFromJson.length > 0) {
          await browser.close();
          return termsFromJson;
        }
      } catch (e) {
        console.log("  Không parse được JSON:", e.message);
      }
    }
  }

  await browser.close();
  return cards.results || [];
}

// Chạy
const URL = "https://quizlet.com/vn/132683022/tu-vung-n5-flash-cards/";
try {
  const cards = await scrapeQuizlet(URL);
  if (cards.length > 0) {
    console.log("\n✅ Mẫu thẻ đầu tiên:");
    cards.slice(0, 5).forEach((c, i) => console.log(`  ${i+1}. ${c.word} — ${c.meaning}`));
    writeFileSync("scripts/quizlet-cards.json", JSON.stringify(cards, null, 2));
    console.log(`\n💾 Đã lưu ${cards.length} thẻ vào scripts/quizlet-cards.json`);
  } else {
    console.log("\n❌ Vẫn không lấy được thẻ. Hãy xem file debug.");
  }
} catch (err) {
  console.error("❌ Lỗi:", err.message);
  console.error(err.stack);
}
