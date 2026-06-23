// scripts/import-vocabulary.ts
// Script này chạy 1 lần duy nhất để nhập từ vựng vào Firebase
// Sau khi chạy xong → xóa file này đi cũng được

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import * as dotenv from "dotenv";

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

// 50 từ vựng N5 cơ bản nhất
const vocabularyN5 = [
  { word: "食べる", reading: "たべる", meaning: "ăn", level: "N5", type: "động từ", example: "私は毎日ご飯を食べる", exampleMeaning: "Tôi ăn cơm mỗi ngày" },
  { word: "飲む", reading: "のむ", meaning: "uống", level: "N5", type: "động từ", example: "水を飲む", exampleMeaning: "Uống nước" },
  { word: "見る", reading: "みる", meaning: "nhìn, xem", level: "N5", type: "động từ", example: "テレビを見る", exampleMeaning: "Xem tivi" },
  { word: "聞く", reading: "きく", meaning: "nghe, hỏi", level: "N5", type: "động từ", example: "音楽を聞く", exampleMeaning: "Nghe nhạc" },
  { word: "話す", reading: "はなす", meaning: "nói chuyện", level: "N5", type: "động từ", example: "日本語を話す", exampleMeaning: "Nói tiếng Nhật" },
  { word: "書く", reading: "かく", meaning: "viết", level: "N5", type: "động từ", example: "手紙を書く", exampleMeaning: "Viết thư" },
  { word: "読む", reading: "よむ", meaning: "đọc", level: "N5", type: "động từ", example: "本を読む", exampleMeaning: "Đọc sách" },
  { word: "行く", reading: "いく", meaning: "đi", level: "N5", type: "động từ", example: "学校に行く", exampleMeaning: "Đi học" },
  { word: "来る", reading: "くる", meaning: "đến, tới", level: "N5", type: "động từ", example: "友達が来る", exampleMeaning: "Bạn bè đến" },
  { word: "帰る", reading: "かえる", meaning: "về nhà", level: "N5", type: "động từ", example: "家に帰る", exampleMeaning: "Về nhà" },
  { word: "起きる", reading: "おきる", meaning: "thức dậy", level: "N5", type: "động từ", example: "朝六時に起きる", exampleMeaning: "Thức dậy lúc 6 giờ sáng" },
  { word: "寝る", reading: "ねる", meaning: "ngủ", level: "N5", type: "động từ", example: "早く寝る", exampleMeaning: "Ngủ sớm" },
  { word: "買う", reading: "かう", meaning: "mua", level: "N5", type: "động từ", example: "本を買う", exampleMeaning: "Mua sách" },
  { word: "売る", reading: "うる", meaning: "bán", level: "N5", type: "động từ", example: "車を売る", exampleMeaning: "Bán xe" },
  { word: "使う", reading: "つかう", meaning: "sử dụng", level: "N5", type: "động từ", example: "パソコンを使う", exampleMeaning: "Sử dụng máy tính" },
  { word: "大きい", reading: "おおきい", meaning: "to, lớn", level: "N5", type: "tính từ", example: "大きい犬", exampleMeaning: "Con chó to" },
  { word: "小さい", reading: "ちいさい", meaning: "nhỏ, bé", level: "N5", type: "tính từ", example: "小さい子供", exampleMeaning: "Đứa trẻ nhỏ" },
  { word: "新しい", reading: "あたらしい", meaning: "mới", level: "N5", type: "tính từ", example: "新しい車", exampleMeaning: "Xe mới" },
  { word: "古い", reading: "ふるい", meaning: "cũ", level: "N5", type: "tính từ", example: "古い本", exampleMeaning: "Sách cũ" },
  { word: "高い", reading: "たかい", meaning: "cao, đắt", level: "N5", type: "tính từ", example: "高いビル", exampleMeaning: "Tòa nhà cao" },
  { word: "安い", reading: "やすい", meaning: "rẻ", level: "N5", type: "tính từ", example: "安いお店", exampleMeaning: "Cửa hàng rẻ" },
  { word: "速い", reading: "はやい", meaning: "nhanh", level: "N5", type: "tính từ", example: "速い車", exampleMeaning: "Xe nhanh" },
  { word: "遅い", reading: "おそい", meaning: "chậm, muộn", level: "N5", type: "tính từ", example: "遅い電車", exampleMeaning: "Tàu chậm" },
  { word: "暑い", reading: "あつい", meaning: "nóng (thời tiết)", level: "N5", type: "tính từ", example: "今日は暑い", exampleMeaning: "Hôm nay trời nóng" },
  { word: "寒い", reading: "さむい", meaning: "lạnh", level: "N5", type: "tính từ", example: "冬は寒い", exampleMeaning: "Mùa đông lạnh" },
  { word: "学校", reading: "がっこう", meaning: "trường học", level: "N5", type: "danh từ", example: "学校に行く", exampleMeaning: "Đi học" },
  { word: "先生", reading: "せんせい", meaning: "giáo viên", level: "N5", type: "danh từ", example: "先生に聞く", exampleMeaning: "Hỏi giáo viên" },
  { word: "学生", reading: "がくせい", meaning: "học sinh, sinh viên", level: "N5", type: "danh từ", example: "私は学生です", exampleMeaning: "Tôi là sinh viên" },
  { word: "友達", reading: "ともだち", meaning: "bạn bè", level: "N5", type: "danh từ", example: "友達と遊ぶ", exampleMeaning: "Chơi với bạn bè" },
  { word: "家族", reading: "かぞく", meaning: "gia đình", level: "N5", type: "danh từ", example: "家族と食べる", exampleMeaning: "Ăn cùng gia đình" },
  { word: "水", reading: "みず", meaning: "nước", level: "N5", type: "danh từ", example: "水を飲む", exampleMeaning: "Uống nước" },
  { word: "ご飯", reading: "ごはん", meaning: "cơm, bữa ăn", level: "N5", type: "danh từ", example: "ご飯を食べる", exampleMeaning: "Ăn cơm" },
  { word: "電車", reading: "でんしゃ", meaning: "tàu điện", level: "N5", type: "danh từ", example: "電車で行く", exampleMeaning: "Đi bằng tàu điện" },
  { word: "駅", reading: "えき", meaning: "ga tàu", level: "N5", type: "danh từ", example: "駅で待つ", exampleMeaning: "Đợi ở ga" },
  { word: "病院", reading: "びょういん", meaning: "bệnh viện", level: "N5", type: "danh từ", example: "病院に行く", exampleMeaning: "Đi bệnh viện" },
  { word: "今日", reading: "きょう", meaning: "hôm nay", level: "N5", type: "danh từ", example: "今日は月曜日", exampleMeaning: "Hôm nay là thứ Hai" },
  { word: "明日", reading: "あした", meaning: "ngày mai", level: "N5", type: "danh từ", example: "明日また来る", exampleMeaning: "Ngày mai đến lại" },
  { word: "昨日", reading: "きのう", meaning: "hôm qua", level: "N5", type: "danh từ", example: "昨日映画を見た", exampleMeaning: "Hôm qua xem phim" },
  { word: "今", reading: "いま", meaning: "bây giờ", level: "N5", type: "danh từ", example: "今何時ですか", exampleMeaning: "Bây giờ là mấy giờ?" },
  { word: "時間", reading: "じかん", meaning: "thời gian", level: "N5", type: "danh từ", example: "時間がない", exampleMeaning: "Không có thời gian" },
  { word: "名前", reading: "なまえ", meaning: "tên", level: "N5", type: "danh từ", example: "名前を書く", exampleMeaning: "Viết tên" },
  { word: "電話", reading: "でんわ", meaning: "điện thoại", level: "N5", type: "danh từ", example: "電話をかける", exampleMeaning: "Gọi điện thoại" },
  { word: "本", reading: "ほん", meaning: "sách", level: "N5", type: "danh từ", example: "本を読む", exampleMeaning: "Đọc sách" },
  { word: "車", reading: "くるま", meaning: "xe hơi", level: "N5", type: "danh từ", example: "車で行く", exampleMeaning: "Đi bằng xe hơi" },
  { word: "家", reading: "いえ", meaning: "nhà", level: "N5", type: "danh từ", example: "家に帰る", exampleMeaning: "Về nhà" },
  { word: "仕事", reading: "しごと", meaning: "công việc", level: "N5", type: "danh từ", example: "仕事をする", exampleMeaning: "Làm việc" },
  { word: "お金", reading: "おかね", meaning: "tiền", level: "N5", type: "danh từ", example: "お金がない", exampleMeaning: "Không có tiền" },
  { word: "天気", reading: "てんき", meaning: "thời tiết", level: "N5", type: "danh từ", example: "今日の天気", exampleMeaning: "Thời tiết hôm nay" },
  { word: "私", reading: "わたし", meaning: "tôi", level: "N5", type: "đại từ", example: "私は学生です", exampleMeaning: "Tôi là sinh viên" },
  { word: "あなた", reading: "あなた", meaning: "bạn, anh, chị", level: "N5", type: "đại từ", example: "あなたの名前は？", exampleMeaning: "Tên bạn là gì?" },
];

// Hàm nhập tất cả từ vựng vào Firestore
async function importVocabulary() {
  console.log("🚀 Bắt đầu nhập từ vựng...");
  let count = 0;

  for (const word of vocabularyN5) {
    try {
      await addDoc(collection(db, "vocabulary"), {
        ...word,
        createdAt: new Date(),
      });
      count++;
      console.log(`✅ ${count}. ${word.word} - ${word.meaning}`);
    } catch (error) {
      console.error(`❌ Lỗi: ${word.word}`, error);
    }
  }

  console.log(`\n🎉 Hoàn thành! Đã nhập ${count} từ vựng vào Firebase`);
  process.exit(0);
}

importVocabulary();