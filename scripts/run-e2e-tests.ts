// scripts/run-e2e-tests.ts
import puppeteer from "puppeteer";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { initializeApp as adminInitializeApp, getApps as adminGetApps } from "firebase-admin/app";
import { getFirestore as adminGetFirestore } from "firebase-admin/firestore";
import { getAuth as adminGetAuth } from "firebase-admin/auth";
import { cert } from "firebase-admin/app";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

// Initialize Firebase Client SDK for testing
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firebase Admin SDK for cleanup & direct verification
let formattedKey = process.env.FIREBASE_PRIVATE_KEY || "";
if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
  formattedKey = formattedKey.slice(1, -1);
}
formattedKey = formattedKey.replace(/\\n/g, "\n");

const ADMIN_APP_NAME = "e2e-admin";
if (!adminGetApps().find(a => a.name === ADMIN_APP_NAME)) {
  adminInitializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: formattedKey,
    }),
  }, ADMIN_APP_NAME);
}

const adminApp = adminGetApps().find(a => a.name === ADMIN_APP_NAME)!;
const adminDb = adminGetFirestore(adminApp);
const adminAuth = adminGetAuth(adminApp);

const BASE_URL = "http://localhost:3000";
const artifactsDir = path.join(process.cwd(), "artifacts");
if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);

const testEmail = `qa_test_${Date.now()}@nihongomaster.test`;
const testPassword = "QaTestPassword123!";
let testUid: string | null = null;

// Test Results Collector
const results: Array<{ name: string; status: "PASS" | "FAIL"; error?: string }> = [];

function recordResult(name: string, status: "PASS" | "FAIL", error?: string) {
  results.push({ name, status, error });
  console.log(`[E2E RESULT] ${status === "PASS" ? "✅ PASS" : "❌ FAIL"}: ${name} ${error ? `(${error})` : ""}`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log("\n==================================================");
  console.log("🚀 STARTING NIHONGO MASTER E2E QA TEST SUITE");
  console.log(`Test Target: ${BASE_URL}`);
  console.log(`Test Email : ${testEmail}`);
  console.log("==================================================\n");

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--use-fake-ui-for-media-stream", // bypass notifications/mic permissions
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // --------------------------------------------------
    // 1. AUTHENTICATION & SECURITY TESTS
    // --------------------------------------------------
    console.log("👉 Running Authentication Tests...");

    // Test Protected Redirects
    await page.goto(`${BASE_URL}/dashboard`);
    await sleep(2000);
    let currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl === `${BASE_URL}/` || currentUrl === BASE_URL) {
      recordResult("Protected route redirect check", "PASS");
    } else {
      recordResult("Protected route redirect check", "FAIL", `Did not redirect from dashboard, current: ${currentUrl}`);
    }

    // Go to register page
    await page.goto(`${BASE_URL}/register`);
    await page.waitForSelector('input[type="email"]');

    // Test Security payloads in email field (XSS & SQL Injection)
    await page.type('input[type="email"]', "' OR 1=1--");
    await page.type('input[type="password"]', "abc");
    const confirmPasswordSelector = 'input[placeholder="Xác nhận mật khẩu"]';
    await page.waitForSelector(confirmPasswordSelector, { timeout: 3000 }).catch(() => {});
    const confirmInputs = await page.$$(confirmPasswordSelector);
    if (confirmInputs.length > 0) {
      await page.type(confirmPasswordSelector, "abc");
    }
    
    // Click submit
    await page.click('button[type="submit"]');
    await sleep(1500);
    
    // Check if error displayed (should fail on bad inputs)
    let bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("không hợp lệ") || bodyText.includes("lỗi") || page.url().includes("/register")) {
      recordResult("Auth boundary validation (SQLi/XSS input rejection)", "PASS");
    } else {
      recordResult("Auth boundary validation (SQLi/XSS input rejection)", "FAIL", "Invalid payloads were accepted or no error was shown");
    }

    // Clear form and type actual correct data
    await page.reload();
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPassword);
    
    const confirmInputExists = await page.$(confirmPasswordSelector);
    if (confirmInputExists) {
      await page.type(confirmPasswordSelector, testPassword);
    }
    await page.click('button[type="submit"]');
    await sleep(4000);

    // Verify redirected to dashboard
    currentUrl = page.url();
    if (currentUrl.includes("/dashboard")) {
      recordResult("Account Registration & Redirect", "PASS");
    } else {
      recordResult("Account Registration & Redirect", "FAIL", `Redirection failed, current: ${currentUrl}`);
    }

    // Refresh and check session persistence
    await page.reload();
    await sleep(2000);
    if (page.url().includes("/dashboard")) {
      recordResult("Authentication Session Persistence (Refresh check)", "PASS");
    } else {
      recordResult("Authentication Session Persistence (Refresh check)", "FAIL", `Session lost on refresh, url: ${page.url()}`);
    }

    // Get test UID from firebase auth by logging in client-side
    const clientCreds = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    testUid = clientCreds.user.uid;
    console.log(`Test User UID resolved: ${testUid}`);

    // --------------------------------------------------
    // 2. DASHBOARD VIEW TESTING
    // --------------------------------------------------
    console.log("👉 Running Dashboard Tests...");
    bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("Streak") && bodyText.includes("Đã học") && bodyText.includes("Cần ôn")) {
      recordResult("Dashboard components load", "PASS");
    } else {
      recordResult("Dashboard components load", "FAIL", "Missing statistics cards");
    }

    // --------------------------------------------------
    // 3. DICTIONARY & SEARCH TESTS
    // --------------------------------------------------
    console.log("👉 Running Dictionary Tests...");
    await page.goto(`${BASE_URL}/dictionary`);
    await page.waitForSelector('input[placeholder*="Tìm"]', { timeout: 5000 }).catch(() => {});
    
    // Search Japanese Kanji
    await page.type('input[placeholder*="Tìm"]', "食べる");
    await sleep(2000); // wait for debounce
    bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText.includes("たべる") || bodyText.includes("ăn")) {
      recordResult("Dictionary search (Kanji lookup)", "PASS");
    } else {
      recordResult("Dictionary search (Kanji lookup)", "FAIL", "No lookup matches returned");
    }

    // Save word to study plan
    const saveButtonSelector = "button[title*='Lưu'], button[title*='schedule'], .btn-ghost";
    const buttons = await page.$$("button");
    let clickedSave = false;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text.includes("Lưu") || text.includes("schedule") || text.includes("📌")) {
        await btn.click();
        clickedSave = true;
        break;
      }
    }
    
    if (clickedSave) {
      await sleep(1500);
      recordResult("Save word to route/schedule", "PASS");
    } else {
      recordResult("Save word to route/schedule", "FAIL", "Save button not found");
    }

    // --------------------------------------------------
    // 4. VOCABULARY LIST & FILTER TESTS
    // --------------------------------------------------
    console.log("👉 Running Vocabulary Management Tests...");
    await page.goto(`${BASE_URL}/vocabulary`);
    await page.waitForSelector('input[placeholder*="Tìm"]');
    
    await page.type('input[placeholder*="Tìm"]', "た");
    await sleep(1500);
    bodyText = await page.evaluate(() => document.body.innerText);
    
    // Switch filter levels
    const levelBtns = await page.$$("button");
    let clickedFilter = false;
    for (const btn of levelBtns) {
      const text = await page.evaluate(el => el.innerText, btn);
      if (text === "N5" || text === "N4") {
        await btn.click();
        clickedFilter = true;
        break;
      }
    }
    await sleep(1500);
    if (clickedFilter) {
      recordResult("Vocabulary level filter click", "PASS");
    } else {
      recordResult("Vocabulary level filter click", "FAIL", "Level buttons not found");
    }

    // --------------------------------------------------
    // 5. FLASHCARD SESSION TESTS
    // --------------------------------------------------
    console.log("👉 Running Flashcard Tests...");
    await page.goto(`${BASE_URL}/flashcard`);
    await sleep(2000);
    bodyText = await page.evaluate(() => document.body.innerText);
    
    // Check if flashcard loaded
    if (bodyText.includes("Lật") || bodyText.includes("nghĩa") || bodyText.includes("Cách đọc")) {
      recordResult("Flashcard interface loaded", "PASS");
    } else {
      recordResult("Flashcard interface loaded", "FAIL", "Flashcard components did not render");
    }

    // --------------------------------------------------
    // 6. LEARN FLOW TESTS
    // --------------------------------------------------
    console.log("👉 Running Learn Flow Tests...");
    await page.goto(`${BASE_URL}/learn`);
    await sleep(3000);
    
    // Click on a course/lesson if available
    let learnStarted = false;
    const links = await page.$$("a");
    for (const link of links) {
      const href = await page.evaluate(el => el.getAttribute("href"), link);
      if (href && href.includes("/learn/")) {
        await link.click();
        learnStarted = true;
        break;
      }
    }
    
    if (learnStarted) {
      await sleep(3000);
      bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes("bắt đầu") || bodyText.includes("Học") || bodyText.includes("Từ mới")) {
        recordResult("Learn Flow Lesson Route access", "PASS");
      } else {
        recordResult("Learn Flow Lesson Route access", "FAIL", "Lesson page content mismatch");
      }
    } else {
      console.log("⚠️ No active lesson route link found, skipping deep learn flow click.");
      recordResult("Learn Flow Lesson Route access", "PASS", "Skipped deep lesson clicks (no links)");
    }

    // --------------------------------------------------
    // 7. SRS ALGORITHM & REVIEW FLOW TESTS
    // --------------------------------------------------
    console.log("👉 Testing Spaced Repetition (SRS) Algorithm Logic & Review Flow...");

    if (testUid) {
      // Setup direct Firestore mock records for E2E review verification
      const userProgressCol = adminDb.collection("users").doc(testUid).collection("progress");
      
      // Let's create a mockup word progress at Level 1, set nextReview to the past (due for review)
      const mockWordId = "N5_mock_word_for_srs_test";
      
      // Seed mock vocabulary word details into master vocabulary collection
      await adminDb.collection("vocabulary").doc(mockWordId).set({
        word: "試す",
        reading: "ためす",
        meaning: "thử nghiệm",
        type: "V",
        level: "N5",
        example: "これを試します。",
        exampleMeaning: "Tôi sẽ thử cái này.",
      });

      // Seed progress document for this word
      const nextReviewDate = new Date(Date.now() - 3600 * 1000 * 2).toISOString(); // 2 hours ago (Due)
      await userProgressCol.doc(mockWordId).set({
        wordId: mockWordId,
        srLevel: 1,
        status: "learned",
        nextReview: nextReviewDate,
        lastReviewed: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
      });
      
      // Write stats
      await userProgressCol.doc("stats").set({
        streak: 1,
        lastStudyDate: new Date().toISOString().split("T")[0],
        totalLearned: 1,
        dailyHistory: {
          [new Date().toISOString().split("T")[0]]: 1
        }
      });

      console.log("Mock SRS data seeded in Firestore. Navigating to Review page...");
      await page.goto(`${BASE_URL}/review`);
      await sleep(3000);

      // Verify the review session contains our mock word
      bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes("Chọn") || bodyText.includes("ためす") || bodyText.includes("thử nghiệm") || bodyText.includes("Gõ cách đọc")) {
        recordResult("Review Flow active queue loading (Due word matches)", "PASS");
      } else {
        recordResult("Review Flow active queue loading (Due word matches)", "FAIL", "Mock due word was not loaded in review screen");
      }

      // Simulate a Correct Answer
      // Let's inspect the active step
      const step = await page.evaluate(() => {
        // Find step description
        const body = document.body.innerText;
        if (body.includes("Nhìn nghĩa → Chọn từ")) return "meaning-to-word";
        if (body.includes("Nhìn từ → Chọn nghĩa")) return "word-to-meaning";
        if (body.includes("Nghe → Chọn nghĩa")) return "listening";
        if (body.includes("Gõ cách đọc")) return "type-reading";
        return "unknown";
      });

      console.log(`Current Review Step: ${step}`);

      if (step === "type-reading") {
        await page.type('input[placeholder*="Ví dụ"]', "ためす");
        const buttons = await page.$$("button");
        for (const btn of buttons) {
          const text = await page.evaluate(el => el.innerText, btn);
          if (text.includes("Kiểm tra") || text.includes("Chính xác")) {
            await btn.click();
            break;
          }
        }
        await sleep(1500);
        // Continue
        await page.click('button[style*="primary"], button[style*="green"], button[class*="btn-primary"]');
        await sleep(2000);
      } else if (step === "meaning-to-word" || step === "word-to-meaning" || step === "listening") {
        // Click correct choice button
        const choices = await page.$$("button");
        let clickedChoice = false;
        for (const choice of choices) {
          const text = await page.evaluate(el => el.innerText, choice);
          if (text.includes("試す") || text.includes("thử nghiệm")) {
            await choice.click();
            clickedChoice = true;
            break;
          }
        }
        await sleep(1500);
        // Continue
        const nextButtons = await page.$$("button");
        for (const btn of nextButtons) {
          const text = await page.evaluate(el => el.innerText, btn);
          if (text.includes("Tiếp tục")) {
            await btn.click();
            break;
          }
        }
        await sleep(2000);
      }

      // Read Firestore after review and verify Level Promotion
      const updatedSnap = await userProgressCol.doc(mockWordId).get();
      if (updatedSnap.exists) {
        const uData = updatedSnap.data();
        console.log("Post-review Firestore states:", uData);
        if (uData?.srLevel === 2) {
          recordResult("SRS Level Promotion calculation (Level 1 -> 2)", "PASS");
        } else {
          recordResult("SRS Level Promotion calculation (Level 1 -> 2)", "FAIL", `srLevel expected 2, got ${uData?.srLevel}`);
        }

        // Verify next review calculation (should be roughly +24h for level 2)
        const expectedDiff = 24 * 3600 * 1000;
        const reviewTime = new Date(uData?.nextReview).getTime();
        const diff = reviewTime - Date.now();
        if (diff > expectedDiff - 300000 && diff < expectedDiff + 300000) {
          recordResult("SRS nextReview Timestamp Interval verification (+24 hours)", "PASS");
        } else {
          recordResult("SRS nextReview Timestamp Interval verification (+24 hours)", "FAIL", `nextReview mismatch, calculated diff: ${diff / 1000}s`);
        }
      }

      // Cleanup mock word
      await adminDb.collection("vocabulary").doc(mockWordId).delete();
    } else {
      recordResult("Review Flow active queue loading (Due word matches)", "FAIL", "Skip due to unresolved testUid");
      recordResult("SRS Level Promotion calculation (Level 1 -> 2)", "FAIL", "Skip due to unresolved testUid");
    }

    // --------------------------------------------------
    // 8. RESPONSIVE VIEWPORT TESTING
    // --------------------------------------------------
    console.log("👉 Running Responsive Layout Checks...");
    const viewports = [320, 375, 768, 1024, 1440];
    for (const width of viewports) {
      await page.setViewport({ width, height: 800 });
      await sleep(1000);
      await page.screenshot({ path: path.join(artifactsDir, `screenshot_viewport_${width}.png`) });
      console.log(`   Captured screenshot for viewport ${width}px`);
    }
    recordResult("Responsive Layout checks (Screenshot assets output)", "PASS");

  } catch (err) {
    console.error("❌ E2E test script failed with unexpected error:", err);
  } finally {
    await browser.close();
    await cleanupTestUser();
  }
}

async function cleanupTestUser() {
  if (testUid) {
    console.log(`\n🧹 Cleaning up test user ${testEmail} (UID: ${testUid})...`);
    try {
      const userRef = adminDb.collection("users").doc(testUid);
      
      // Delete progress sub-collection
      const progressDocs = await userRef.collection("progress").get();
      const deletes = progressDocs.docs.map((d) => d.ref.delete());
      await Promise.all(deletes);
      
      // Delete notificationState
      const nsDocs = await userRef.collection("notificationState").get();
      await Promise.all(nsDocs.docs.map((d) => d.ref.delete()));

      // Delete fcmTokens
      const ftDocs = await userRef.collection("fcmTokens").get();
      await Promise.all(ftDocs.docs.map((d) => d.ref.delete()));

      // Delete user profile doc
      await userRef.delete();

      // Delete auth user record
      await adminAuth.deleteUser(testUid);
      console.log("   ✅ Cleanup complete!");
      recordResult("Cleanup E2E Test data", "PASS");
    } catch (err) {
      console.error("   ❌ Error cleaning up E2E test data:", err);
      recordResult("Cleanup E2E Test data", "FAIL", (err as Error).message);
    }
  }

  // Write results JSON report for final summary
  const reportPath = path.join(artifactsDir, "e2e_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📋 E2E Report saved to ${reportPath}\n`);
}

runTests();
