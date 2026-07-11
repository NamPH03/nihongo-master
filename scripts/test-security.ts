// scripts/test-security.ts
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const results: Array<{ name: string; status: "PASS" | "FAIL"; error?: string }> = [];

function recordResult(name: string, status: "PASS" | "FAIL", error?: string) {
  results.push({ name, status, error });
  console.log(`[SECURITY RESULT] ${status === "PASS" ? "🛡️ PASS" : "🚨 FAIL"}: ${name} ${error ? `(${error})` : ""}`);
}

async function runSecurityTests() {
  console.log("\n==================================================");
  console.log("🔒 NIHONGO MASTER SECURITY AUDIT TOOL");
  console.log("==================================================\n");

  // TEST 1: Unauthorized read on another user's progress/stats
  try {
    const targetUid = "unauthorized_test_uid_9999";
    const ref = doc(db, "users", targetUid, "progress", "stats");
    await getDoc(ref);
    recordResult("Unauthorized READ access to user progress/stats document", "FAIL", "Succeeded in reading user progress stats without authentication!");
  } catch (err) {
    const errMsg = (err as Error).message || "";
    if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
      recordResult("Unauthorized READ access to user progress/stats document", "PASS");
    } else {
      recordResult("Unauthorized READ access to user progress/stats document", "FAIL", `Failed with unexpected error: ${errMsg}`);
    }
  }

  // TEST 2: Unauthorized write/manipulation of user stats
  try {
    const targetUid = "unauthorized_test_uid_9999";
    const ref = doc(db, "users", targetUid, "progress", "stats");
    await setDoc(ref, { streak: 999, totalLearned: 999 }, { merge: true });
    recordResult("Unauthorized WRITE access to user progress/stats document", "FAIL", "Succeeded in writing user progress stats without authentication!");
  } catch (err) {
    const errMsg = (err as Error).message || "";
    if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
      recordResult("Unauthorized WRITE access to user progress/stats document", "PASS");
    } else {
      recordResult("Unauthorized WRITE access to user progress/stats document", "FAIL", `Failed with unexpected error: ${errMsg}`);
    }
  }

  // TEST 3: Unauthorized write to vocabulary collection
  try {
    const ref = doc(db, "vocabulary", "N5_malicious_injected_word");
    await setDoc(ref, {
      word: "悪い",
      reading: "わるい",
      meaning: "độc hại",
      level: "N5",
      type: "Adj",
    });
    recordResult("Unauthorized WRITE access to vocabulary database", "FAIL", "Succeeded in writing to main vocabulary collection!");
  } catch (err) {
    const errMsg = (err as Error).message || "";
    if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
      recordResult("Unauthorized WRITE access to vocabulary database", "PASS");
    } else {
      recordResult("Unauthorized WRITE access to vocabulary database", "FAIL", `Failed with unexpected error: ${errMsg}`);
    }
  }

  // TEST 4: Unauthorized read on user FCM Tokens
  try {
    const targetUid = "unauthorized_test_uid_9999";
    const ref = collection(db, "users", targetUid, "fcmTokens");
    await getDocs(ref);
    recordResult("Unauthorized READ access to user push notification FCM tokens", "FAIL", "Succeeded in reading user FCM tokens collection!");
  } catch (err) {
    const errMsg = (err as Error).message || "";
    if (errMsg.includes("permission-denied") || errMsg.includes("Missing or insufficient permissions")) {
      recordResult("Unauthorized READ access to user push notification FCM tokens", "PASS");
    } else {
      recordResult("Unauthorized READ access to user push notification FCM tokens", "FAIL", `Failed with unexpected error: ${errMsg}`);
    }
  }

  // Write results JSON report
  const artifactsDir = path.join(process.cwd(), "artifacts");
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);
  const reportPath = path.join(artifactsDir, "security_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📋 Security Report saved to ${reportPath}\n`);
}

runSecurityTests();
