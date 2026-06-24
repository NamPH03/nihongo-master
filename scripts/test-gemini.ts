// scripts/test-gemini.ts
// Test Gemini API với 10 từ đầu — xem câu ví dụ có đúng không

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 10 từ đầu để test
const testWords = [
  { word: "ベトナム", reading: "ベトナム", meaning: "Việt Nam" },
  { word: "日本", reading: "にほん", meaning: "Nhật Bản" },
  { word: "私", reading: "わたし", meaning: "tôi" },
  { word: "食べる", reading: "たべる", meaning: "ăn" },
  { word: "飲む", reading: "のむ", meaning: "uống" },
  { word: "学校", reading: "がっこう", meaning: "trường học" },
  { word: "先生", reading: "せんせい", meaning: "thầy cô giáo" },
  { word: "友達", reading: "ともだち", meaning: "bạn bè" },
  { word: "大きい", reading: "おおきい", meaning: "to, lớn" },
  { word: "好き", reading: "すき", meaning: "thích" },
];

async function testGemini(word: string, reading: string, meaning: string) {
  const prompt = `Tạo 1 câu ví dụ tiếng Nhật đơn giản (trình độ N5) cho từ sau:
- Từ: ${word}
- Cách đọc: ${reading}
- Nghĩa: ${meaning}

Yêu cầu:
- Câu ngắn gọn, đơn giản, phù hợp N5
- Phải dùng từ "${word}" trong câu
- Chỉ trả về JSON, không giải thích thêm

Định dạng trả về:
{"example": "câu tiếng Nhật ở đây", "exampleMeaning": "nghĩa tiếng Việt ở đây"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    console.log(`\n📝 Raw response cho "${word}":`);
    console.log(text); // In ra để xem Gemini trả về gì

    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    console.log(`✅ Parse thành công:`);
    console.log(`   Ví dụ: ${parsed.example}`);
    console.log(`   Nghĩa: ${parsed.exampleMeaning}`);

    return parsed;
  } catch (error) {
    console.log(`❌ Lỗi với từ "${word}":`, error);
    return null;
  }
}

async function main() {
  console.log("🧪 Bắt đầu test Gemini API với 10 từ...\n");
  console.log(`API Key: ${process.env.GOOGLE_API_KEY ? "✅ Có" : "❌ Không tìm thấy"}`);
  console.log("=".repeat(50));

  let success = 0;
  let failed = 0;

  for (const item of testWords) {
    const result = await testGemini(item.word, item.reading, item.meaning);
    if (result) success++;
    else failed++;

    // Nghỉ 1 giây giữa các lần gọi
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\n" + "=".repeat(50));
  console.log(`🎯 KẾT QUẢ TEST:`);
  console.log(`   ✅ Thành công: ${success}/10`);
  console.log(`   ❌ Thất bại : ${failed}/10`);
}

main();