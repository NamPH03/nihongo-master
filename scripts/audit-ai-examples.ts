// scripts/audit-ai-examples.ts
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, limit } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

// Initialize Gemini for auditing
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json",
  } as any,
});

type VocabItem = {
  id: string;
  word: string;
  reading: string;
  meaning: string;
  level: string;
  example: string;
  exampleMeaning: string;
};

type AuditReportItem = {
  word: string;
  example: string;
  exampleMeaning: string;
  grammaticallyCorrect: boolean;
  n5Appropriate: boolean;
  translationAccurate: boolean;
  feedback: string;
};

async function auditExamples() {
  console.log("\n==================================================");
  console.log("🤖 NIHONGO MASTER AI EXAMPLE SENTENCE AUDIT TOOL");
  console.log("==================================================\n");

  try {
    const vocabSnap = await getDocs(
      query(collection(db, "vocabulary"), where("level", "==", "N5"), limit(15))
    );

    const items: VocabItem[] = [];
    vocabSnap.forEach((doc) => {
      const data = doc.data();
      if (data.example) {
        items.push({
          id: doc.id,
          word: data.word || "",
          reading: data.reading || "",
          meaning: data.meaning || "",
          level: data.level || "N5",
          example: data.example || "",
          exampleMeaning: data.exampleMeaning || "",
        });
      }
    });

    if (items.length === 0) {
      console.log("⚠️ No vocabulary items with examples found in Firestore database!");
      return;
    }

    console.log(`🔍 Found ${items.length} examples for N5 words. Sending to Gemini for quality review...`);

    const prompt = `Bạn là một chuyên gia ngôn ngữ tiếng Nhật và chuyên gia kiểm thử. Hãy đánh giá các câu ví dụ và bản dịch tiếng Việt cho trình độ N5 dưới đây.
Dữ liệu cần đánh giá:
${JSON.stringify(items.map(i => ({ word: i.word, reading: i.reading, meaning: i.meaning, example: i.example, exampleMeaning: i.exampleMeaning })), null, 2)}

Hãy phân tích từng mục và trả về JSON có cấu trúc là một mảng các đối tượng chứa:
- "word": từ đang đánh giá
- "example": câu ví dụ
- "exampleMeaning": nghĩa câu ví dụ
- "grammaticallyCorrect": true/false (câu tiếng Nhật có đúng ngữ pháp và tự nhiên không)
- "n5Appropriate": true/false (ngữ pháp và từ vựng của câu có quá phức tạp cho trình độ N5 không. N5 chỉ nên dùng các từ và cấu trúc cơ bản như です/ます,  cấu trúc cơ bản)
- "translationAccurate": true/false (bản dịch tiếng Việt có chính xác không)
- "feedback": nhận xét chi tiết bằng tiếng Việt (nếu có lỗi hãy giải thích rõ, chỉ ra lỗi sai ngữ pháp hoặc lỗi dịch nghĩa)

Trả về định dạng JSON đúng cấu trúc:
[
  {
    "word": "...",
    "example": "...",
    "exampleMeaning": "...",
    "grammaticallyCorrect": true,
    "n5Appropriate": true,
    "translationAccurate": true,
    "feedback": "..."
  }
]`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const cleaned = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const auditResults: AuditReportItem[] = JSON.parse(cleaned);

    console.log("\n📊 AUDIT SUMMARY FROM GEMINI:");
    let failures = 0;
    auditResults.forEach((res) => {
      console.log(`\n• Từ: ${res.word} | Ví dụ: ${res.example}`);
      console.log(`  - Đúng ngữ pháp: ${res.grammaticallyCorrect ? "✅ Yes" : "❌ No"}`);
      console.log(`  - Phù hợp N5: ${res.n5Appropriate ? "✅ Yes" : "❌ No"}`);
      console.log(`  - Dịch chuẩn: ${res.translationAccurate ? "✅ Yes" : "❌ No"}`);
      console.log(`  - Nhận xét: ${res.feedback}`);
      if (!res.grammaticallyCorrect || !res.n5Appropriate || !res.translationAccurate) {
        failures++;
      }
    });

    console.log(`\n==================================================`);
    console.log(`Total Audited : ${auditResults.length}`);
    console.log(`Total Flawed  : ${failures}`);
    console.log(`==================================================`);

    const artifactsDir = path.join(process.cwd(), "artifacts");
    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir);
    const reportPath = path.join(artifactsDir, "ai_audit_report.json");
    fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
    console.log(`\n📋 Audit Report saved to ${reportPath}\n`);

  } catch (err) {
    console.error("❌ Example audit failed with error:", err);
  }
}

auditExamples();
