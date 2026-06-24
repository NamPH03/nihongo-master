// scripts/import-n5-full.ts
// Script nhập toàn bộ từ vựng N5 vào Firebase
// Chạy 1 lần duy nhất!

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

const vocabularyN5 = [
  { word: "ベトナム", reading: "ベトナム", type: "N", meaning: "Việt Nam", level: "N5", example: "ベトナムは東南アジアにあります。", exampleMeaning: "Việt Nam nằm ở Đông Nam Á." },
  { word: "日本", reading: "にほん", type: "N", meaning: "Nhật Bản", level: "N5", example: "日本語を勉強しています。", exampleMeaning: "Tôi đang học tiếng Nhật." },
  { word: "中国", reading: "ちゅうごく", type: "N", meaning: "Trung Quốc", level: "N5", example: "中国はとても大きい国です。", exampleMeaning: "Trung Quốc là đất nước rất lớn." },
  { word: "韓国", reading: "かんこく", type: "N", meaning: "Hàn Quốc", level: "N5", example: "韓国料理が好きです。", exampleMeaning: "Tôi thích đồ ăn Hàn Quốc." },
  { word: "私", reading: "わたし", type: "N", meaning: "tôi", level: "N5", example: "私は学生です。", exampleMeaning: "Tôi là sinh viên." },
  { word: "医者", reading: "いしゃ", type: "N", meaning: "bác sĩ", level: "N5", example: "医者に行きます。", exampleMeaning: "Tôi đi gặp bác sĩ." },
  { word: "教師", reading: "きょうし", type: "N", meaning: "giáo viên", level: "N5", example: "教師になりたいです。", exampleMeaning: "Tôi muốn trở thành giáo viên." },
  { word: "先生", reading: "せんせい", type: "N", meaning: "thầy cô giáo", level: "N5", example: "先生に質問します。", exampleMeaning: "Tôi hỏi thầy giáo." },
  { word: "銀行員", reading: "ぎんこういん", type: "N", meaning: "nhân viên ngân hàng", level: "N5", example: "兄は銀行員です。", exampleMeaning: "Anh trai tôi là nhân viên ngân hàng." },
  { word: "会社員", reading: "かいしゃいん", type: "N", meaning: "nhân viên công ty", level: "N5", example: "父は会社員です。", exampleMeaning: "Bố tôi là nhân viên công ty." },
  { word: "学生", reading: "がくせい", type: "N", meaning: "sinh viên", level: "N5", example: "私は大学生です。", exampleMeaning: "Tôi là sinh viên đại học." },
  { word: "料理", reading: "りょうり", type: "N", meaning: "món ăn", level: "N5", example: "料理を作ります。", exampleMeaning: "Tôi nấu ăn." },
  { word: "ビール", reading: "ビール", type: "N", meaning: "bia", level: "N5", example: "ビールを飲みます。", exampleMeaning: "Tôi uống bia." },
  { word: "コーヒー", reading: "コーヒー", type: "N", meaning: "cà phê", level: "N5", example: "毎朝コーヒーを飲みます。", exampleMeaning: "Mỗi sáng tôi uống cà phê." },
  { word: "朝", reading: "あさ", type: "N", meaning: "buổi sáng", level: "N5", example: "朝ご飯を食べます。", exampleMeaning: "Tôi ăn sáng." },
  { word: "夜", reading: "よる", type: "N", meaning: "buổi tối", level: "N5", example: "夜遅く寝ます。", exampleMeaning: "Tôi ngủ muộn vào buổi tối." },
  { word: "今日", reading: "きょう", type: "N", meaning: "hôm nay", level: "N5", example: "今日は天気がいいです。", exampleMeaning: "Hôm nay thời tiết đẹp." },
  { word: "明日", reading: "あした", type: "N", meaning: "ngày mai", level: "N5", example: "明日また来ます。", exampleMeaning: "Ngày mai tôi lại đến." },
  { word: "明後日", reading: "あさって", type: "N", meaning: "ngày kia", level: "N5", example: "明後日、旅行に行きます。", exampleMeaning: "Ngày kia tôi đi du lịch." },
  { word: "休み", reading: "やすみ", type: "N", meaning: "nghỉ ngơi", level: "N5", example: "今日は休みです。", exampleMeaning: "Hôm nay tôi nghỉ." },
  { word: "仕事", reading: "しごと", type: "N", meaning: "công việc", level: "N5", example: "仕事が忙しいです。", exampleMeaning: "Công việc bận rộn." },
  { word: "学校", reading: "がっこう", type: "N", meaning: "trường học", level: "N5", example: "学校に行きます。", exampleMeaning: "Tôi đi học." },
  { word: "図書館", reading: "としょかん", type: "N", meaning: "thư viện", level: "N5", example: "図書館で勉強します。", exampleMeaning: "Tôi học ở thư viện." },
  { word: "郵便局", reading: "ゆうびんきょく", type: "N", meaning: "bưu điện", level: "N5", example: "郵便局で手紙を出します。", exampleMeaning: "Tôi gửi thư ở bưu điện." },
  { word: "病院", reading: "びょういん", type: "N", meaning: "bệnh viện", level: "N5", example: "病院に行きます。", exampleMeaning: "Tôi đi bệnh viện." },
  { word: "銀行", reading: "ぎんこう", type: "N", meaning: "ngân hàng", level: "N5", example: "銀行でお金を下ろします。", exampleMeaning: "Tôi rút tiền ở ngân hàng." },
  { word: "会社", reading: "かいしゃ", type: "N", meaning: "công ty", level: "N5", example: "会社に行きます。", exampleMeaning: "Tôi đi làm." },
  { word: "レストラン", reading: "レストラン", type: "N", meaning: "nhà hàng", level: "N5", example: "レストランで食べます。", exampleMeaning: "Tôi ăn ở nhà hàng." },
  { word: "スーパー", reading: "スーパー", type: "N", meaning: "siêu thị", level: "N5", example: "スーパーで買い物します。", exampleMeaning: "Tôi mua sắm ở siêu thị." },
  { word: "日本語", reading: "にほんご", type: "N", meaning: "tiếng Nhật", level: "N5", example: "日本語を勉強します。", exampleMeaning: "Tôi học tiếng Nhật." },
  { word: "英語", reading: "えいご", type: "N", meaning: "tiếng Anh", level: "N5", example: "英語が話せますか。", exampleMeaning: "Bạn có nói được tiếng Anh không?" },
  { word: "漢字", reading: "かんじ", type: "N", meaning: "chữ Hán", level: "N5", example: "漢字を覚えます。", exampleMeaning: "Tôi học thuộc chữ Hán." },
  { word: "ひらがな", reading: "ひらがな", type: "N", meaning: "chữ hiragana", level: "N5", example: "ひらがなを書きます。", exampleMeaning: "Tôi viết chữ hiragana." },
  { word: "カタカナ", reading: "カタカナ", type: "N", meaning: "chữ katakana", level: "N5", example: "カタカナも読めます。", exampleMeaning: "Tôi cũng đọc được katakana." },
  { word: "辞書", reading: "じしょ", type: "N", meaning: "từ điển", level: "N5", example: "辞書で調べます。", exampleMeaning: "Tôi tra từ điển." },
  { word: "かばん", reading: "かばん", type: "N", meaning: "cặp, túi", level: "N5", example: "かばんに本を入れます。", exampleMeaning: "Tôi bỏ sách vào túi." },
  { word: "手帳", reading: "てちょう", type: "N", meaning: "sổ tay", level: "N5", example: "手帳に書きます。", exampleMeaning: "Tôi ghi vào sổ tay." },
  { word: "月曜日", reading: "げつようび", type: "N", meaning: "thứ Hai", level: "N5", example: "月曜日に授業があります。", exampleMeaning: "Thứ Hai có buổi học." },
  { word: "火曜日", reading: "かようび", type: "N", meaning: "thứ Ba", level: "N5", example: "火曜日は休みです。", exampleMeaning: "Thứ Ba tôi nghỉ." },
  { word: "水曜日", reading: "すいようび", type: "N", meaning: "thứ Tư", level: "N5", example: "水曜日に会議があります。", exampleMeaning: "Thứ Tư có cuộc họp." },
  { word: "木曜日", reading: "もくようび", type: "N", meaning: "thứ Năm", level: "N5", example: "木曜日に友達と会います。", exampleMeaning: "Thứ Năm tôi gặp bạn bè." },
  { word: "金曜日", reading: "きんようび", type: "N", meaning: "thứ Sáu", level: "N5", example: "金曜日の夜は楽しいです。", exampleMeaning: "Tối thứ Sáu rất vui." },
  { word: "土曜日", reading: "どようび", type: "N", meaning: "thứ Bảy", level: "N5", example: "土曜日に買い物します。", exampleMeaning: "Thứ Bảy tôi đi mua sắm." },
  { word: "日曜日", reading: "にちようび", type: "N", meaning: "Chủ nhật", level: "N5", example: "日曜日は家にいます。", exampleMeaning: "Chủ nhật tôi ở nhà." },
  { word: "食べる", reading: "たべる", type: "V II", meaning: "ăn", level: "N5", example: "毎日ご飯を食べます。", exampleMeaning: "Mỗi ngày tôi ăn cơm." },
  { word: "飲む", reading: "のむ", type: "V I", meaning: "uống", level: "N5", example: "水を飲みます。", exampleMeaning: "Tôi uống nước." },
  { word: "見る", reading: "みる", type: "V II", meaning: "nhìn, xem", level: "N5", example: "テレビを見ます。", exampleMeaning: "Tôi xem tivi." },
  { word: "聞く", reading: "きく", type: "V I", meaning: "nghe, hỏi", level: "N5", example: "音楽を聞きます。", exampleMeaning: "Tôi nghe nhạc." },
  { word: "話す", reading: "はなす", type: "V I", meaning: "nói chuyện", level: "N5", example: "日本語で話します。", exampleMeaning: "Tôi nói bằng tiếng Nhật." },
  { word: "書く", reading: "かく", type: "V I", meaning: "viết", level: "N5", example: "手紙を書きます。", exampleMeaning: "Tôi viết thư." },
  { word: "読む", reading: "よむ", type: "V I", meaning: "đọc", level: "N5", example: "本を読みます。", exampleMeaning: "Tôi đọc sách." },
  { word: "行く", reading: "いく", type: "V I", meaning: "đi", level: "N5", example: "学校に行きます。", exampleMeaning: "Tôi đi học." },
  { word: "来る", reading: "くる", type: "V III", meaning: "đến", level: "N5", example: "友達が来ます。", exampleMeaning: "Bạn tôi đến." },
  { word: "帰る", reading: "かえる", type: "V I", meaning: "về nhà", level: "N5", example: "家に帰ります。", exampleMeaning: "Tôi về nhà." },
  { word: "起きる", reading: "おきる", type: "V II", meaning: "thức dậy", level: "N5", example: "６時に起きます。", exampleMeaning: "Tôi thức dậy lúc 6 giờ." },
  { word: "寝る", reading: "ねる", type: "V II", meaning: "ngủ", level: "N5", example: "早く寝ます。", exampleMeaning: "Tôi ngủ sớm." },
  { word: "買う", reading: "かう", type: "V I", meaning: "mua", level: "N5", example: "本を買います。", exampleMeaning: "Tôi mua sách." },
  { word: "使う", reading: "つかう", type: "V I", meaning: "sử dụng", level: "N5", example: "パソコンを使います。", exampleMeaning: "Tôi sử dụng máy tính." },
  { word: "する", reading: "する", type: "V III", meaning: "làm", level: "N5", example: "宿題をします。", exampleMeaning: "Tôi làm bài tập." },
  { word: "ある", reading: "ある", type: "V I", meaning: "có (đồ vật)", level: "N5", example: "机の上に本があります。", exampleMeaning: "Có sách trên bàn." },
  { word: "いる", reading: "いる", type: "V II", meaning: "có (người, động vật)", level: "N5", example: "部屋に猫がいます。", exampleMeaning: "Có mèo trong phòng." },
  { word: "分かる", reading: "わかる", type: "V I", meaning: "hiểu, biết", level: "N5", example: "日本語が分かります。", exampleMeaning: "Tôi hiểu tiếng Nhật." },
  { word: "大きい", reading: "おおきい", type: "A い", meaning: "to, lớn", level: "N5", example: "大きい犬がいます。", exampleMeaning: "Có con chó to." },
  { word: "小さい", reading: "ちいさい", type: "A い", meaning: "nhỏ, bé", level: "N5", example: "小さい子供がいます。", exampleMeaning: "Có đứa trẻ nhỏ." },
  { word: "新しい", reading: "あたらしい", type: "A い", meaning: "mới", level: "N5", example: "新しい車を買いました。", exampleMeaning: "Tôi đã mua xe mới." },
  { word: "古い", reading: "ふるい", type: "A い", meaning: "cũ", level: "N5", example: "古い本があります。", exampleMeaning: "Có quyển sách cũ." },
  { word: "高い", reading: "たかい", type: "A い", meaning: "cao, đắt", level: "N5", example: "このビルは高いです。", exampleMeaning: "Tòa nhà này cao." },
  { word: "安い", reading: "やすい", type: "A い", meaning: "rẻ", level: "N5", example: "このお店は安いです。", exampleMeaning: "Cửa hàng này rẻ." },
  { word: "暑い", reading: "あつい", type: "A い", meaning: "nóng (thời tiết)", level: "N5", example: "今日は暑いです。", exampleMeaning: "Hôm nay trời nóng." },
  { word: "寒い", reading: "さむい", type: "A い", meaning: "lạnh", level: "N5", example: "冬は寒いです。", exampleMeaning: "Mùa đông lạnh." },
  { word: "楽しい", reading: "たのしい", type: "A い", meaning: "vui vẻ", level: "N5", example: "旅行は楽しいです。", exampleMeaning: "Du lịch rất vui." },
  { word: "難しい", reading: "むずかしい", type: "A い", meaning: "khó", level: "N5", example: "日本語は難しいです。", exampleMeaning: "Tiếng Nhật khó." },
  { word: "易しい", reading: "やさしい", type: "A い", meaning: "dễ", level: "N5", example: "この問題は易しいです。", exampleMeaning: "Bài tập này dễ." },
  { word: "好き", reading: "すき", type: "A な", meaning: "thích", level: "N5", example: "音楽が好きです。", exampleMeaning: "Tôi thích âm nhạc." },
  { word: "嫌い", reading: "きらい", type: "A な", meaning: "ghét, không thích", level: "N5", example: "野菜が嫌いです。", exampleMeaning: "Tôi không thích rau." },
  { word: "きれい", reading: "きれい", type: "A な", meaning: "đẹp, sạch", level: "N5", example: "花がきれいです。", exampleMeaning: "Hoa đẹp quá." },
  { word: "静か", reading: "しずか", type: "A な", meaning: "yên tĩnh", level: "N5", example: "図書館は静かです。", exampleMeaning: "Thư viện yên tĩnh." },
  { word: "にぎやか", reading: "にぎやか", type: "A な", meaning: "nhộn nhịp, sôi động", level: "N5", example: "駅の前はにぎやかです。", exampleMeaning: "Trước ga rất nhộn nhịp." },
  { word: "元気", reading: "げんき", type: "A な", meaning: "khỏe mạnh, vui vẻ", level: "N5", example: "元気ですか。", exampleMeaning: "Bạn có khỏe không?" },
  { word: "有名", reading: "ゆうめい", type: "A な", meaning: "nổi tiếng", level: "N5", example: "有名な店です。", exampleMeaning: "Đây là cửa hàng nổi tiếng." },
  { word: "今", reading: "いま", type: "N", meaning: "bây giờ", level: "N5", example: "今何時ですか。", exampleMeaning: "Bây giờ là mấy giờ?" },
  { word: "時間", reading: "じかん", type: "N", meaning: "thời gian", level: "N5", example: "時間がありません。", exampleMeaning: "Tôi không có thời gian." },
  { word: "名前", reading: "なまえ", type: "N", meaning: "tên", level: "N5", example: "名前を教えてください。", exampleMeaning: "Cho tôi biết tên bạn." },
  { word: "電話", reading: "でんわ", type: "N", meaning: "điện thoại", level: "N5", example: "電話をかけます。", exampleMeaning: "Tôi gọi điện thoại." },
  { word: "本", reading: "ほん", type: "N", meaning: "sách", level: "N5", example: "本を読みます。", exampleMeaning: "Tôi đọc sách." },
  { word: "車", reading: "くるま", type: "N", meaning: "xe hơi", level: "N5", example: "車で行きます。", exampleMeaning: "Tôi đi bằng xe hơi." },
  { word: "家", reading: "いえ", type: "N", meaning: "nhà", level: "N5", example: "家に帰ります。", exampleMeaning: "Tôi về nhà." },
  { word: "お金", reading: "おかね", type: "N", meaning: "tiền", level: "N5", example: "お金がありません。", exampleMeaning: "Tôi không có tiền." },
  { word: "天気", reading: "てんき", type: "N", meaning: "thời tiết", level: "N5", example: "今日の天気はいいです。", exampleMeaning: "Thời tiết hôm nay đẹp." },
  { word: "友達", reading: "ともだち", type: "N", meaning: "bạn bè", level: "N5", example: "友達と遊びます。", exampleMeaning: "Tôi chơi với bạn bè." },
  { word: "家族", reading: "かぞく", type: "N", meaning: "gia đình", level: "N5", example: "家族と食べます。", exampleMeaning: "Tôi ăn cùng gia đình." },
  { word: "電車", reading: "でんしゃ", type: "N", meaning: "tàu điện", level: "N5", example: "電車で行きます。", exampleMeaning: "Tôi đi bằng tàu điện." },
  { word: "駅", reading: "えき", type: "N", meaning: "ga tàu", level: "N5", example: "駅で待ちます。", exampleMeaning: "Tôi đợi ở ga." },
  { word: "水", reading: "みず", type: "N", meaning: "nước", level: "N5", example: "水を飲みます。", exampleMeaning: "Tôi uống nước." },
  { word: "ご飯", reading: "ごはん", type: "N", meaning: "cơm, bữa ăn", level: "N5", example: "ご飯を食べます。", exampleMeaning: "Tôi ăn cơm." },
  { word: "肉", reading: "にく", type: "N", meaning: "thịt", level: "N5", example: "肉が好きです。", exampleMeaning: "Tôi thích thịt." },
  { word: "魚", reading: "さかな", type: "N", meaning: "cá", level: "N5", example: "魚を食べます。", exampleMeaning: "Tôi ăn cá." },
  { word: "野菜", reading: "やさい", type: "N", meaning: "rau", level: "N5", example: "野菜を食べます。", exampleMeaning: "Tôi ăn rau." },
  { word: "果物", reading: "くだもの", type: "N", meaning: "hoa quả", level: "N5", example: "果物が好きです。", exampleMeaning: "Tôi thích hoa quả." },
  { word: "花", reading: "はな", type: "N", meaning: "hoa", level: "N5", example: "花がきれいです。", exampleMeaning: "Hoa đẹp quá." },
  { word: "山", reading: "やま", type: "N", meaning: "núi", level: "N5", example: "山に登ります。", exampleMeaning: "Tôi leo núi." },
  { word: "川", reading: "かわ", type: "N", meaning: "sông", level: "N5", example: "川で泳ぎます。", exampleMeaning: "Tôi bơi ở sông." },
  { word: "海", reading: "うみ", type: "N", meaning: "biển", level: "N5", example: "海で泳ぎます。", exampleMeaning: "Tôi bơi ở biển." },
  { word: "空", reading: "そら", type: "N", meaning: "bầu trời", level: "N5", example: "空が青いです。", exampleMeaning: "Bầu trời xanh." },
  { word: "雨", reading: "あめ", type: "N", meaning: "mưa", level: "N5", example: "雨が降っています。", exampleMeaning: "Trời đang mưa." },
  { word: "雪", reading: "ゆき", type: "N", meaning: "tuyết", level: "N5", example: "雪が降っています。", exampleMeaning: "Trời đang có tuyết." },
  { word: "部屋", reading: "へや", type: "N", meaning: "phòng", level: "N5", example: "部屋を掃除します。", exampleMeaning: "Tôi dọn phòng." },
  { word: "机", reading: "つくえ", type: "N", meaning: "bàn", level: "N5", example: "机の上に本があります。", exampleMeaning: "Có sách trên bàn." },
  { word: "椅子", reading: "いす", type: "N", meaning: "ghế", level: "N5", example: "椅子に座ります。", exampleMeaning: "Tôi ngồi xuống ghế." },
  { word: "窓", reading: "まど", type: "N", meaning: "cửa sổ", level: "N5", example: "窓を開けます。", exampleMeaning: "Tôi mở cửa sổ." },
  { word: "door", reading: "ドア", type: "N", meaning: "cửa ra vào", level: "N5", example: "ドアを閉めます。", exampleMeaning: "Tôi đóng cửa." },
  { word: "写真", reading: "しゃしん", type: "N", meaning: "ảnh, hình", level: "N5", example: "写真を撮ります。", exampleMeaning: "Tôi chụp ảnh." },
  { word: "音楽", reading: "おんがく", type: "N", meaning: "âm nhạc", level: "N5", example: "音楽を聞きます。", exampleMeaning: "Tôi nghe nhạc." },
  { word: "映画", reading: "えいが", type: "N", meaning: "phim", level: "N5", example: "映画を見ます。", exampleMeaning: "Tôi xem phim." },
  { word: "旅行", reading: "りょこう", type: "N", meaning: "du lịch", level: "N5", example: "旅行が好きです。", exampleMeaning: "Tôi thích du lịch." },
  { word: "スポーツ", reading: "スポーツ", type: "N", meaning: "thể thao", level: "N5", example: "スポーツをします。", exampleMeaning: "Tôi chơi thể thao." },
  { word: "サッカー", reading: "サッカー", type: "N", meaning: "bóng đá", level: "N5", example: "サッカーが好きです。", exampleMeaning: "Tôi thích bóng đá." },
  { word: "春", reading: "はる", type: "N", meaning: "mùa xuân", level: "N5", example: "春は花がきれいです。", exampleMeaning: "Mùa xuân hoa đẹp." },
  { word: "夏", reading: "なつ", type: "N", meaning: "mùa hè", level: "N5", example: "夏は暑いです。", exampleMeaning: "Mùa hè nóng." },
  { word: "秋", reading: "あき", type: "N", meaning: "mùa thu", level: "N5", example: "秋は涼しいです。", exampleMeaning: "Mùa thu mát mẻ." },
  { word: "冬", reading: "ふゆ", type: "N", meaning: "mùa đông", level: "N5", example: "冬は寒いです。", exampleMeaning: "Mùa đông lạnh." },
];

async function deleteOldVocabulary() {
  console.log("🗑️  Xóa từ vựng cũ...");
  const snapshot = await getDocs(collection(db, "vocabulary"));
  for (const document of snapshot.docs) {
    await deleteDoc(doc(db, "vocabulary", document.id));
  }
  console.log(`✅ Đã xóa ${snapshot.size} từ cũ`);
}

async function importVocabulary() {
  await deleteOldVocabulary();
  console.log("\n🚀 Bắt đầu nhập từ vựng mới...");
  let count = 0;
  for (const word of vocabularyN5) {
    try {
      await addDoc(collection(db, "vocabulary"), {
        ...word,
        status: "new",        // new = chưa học, learning = đang học, learned = đã nhớ
        createdAt: new Date(),
      });
      count++;
      console.log(`✅ ${count}. ${word.word} - ${word.meaning}`);
    } catch (error) {
      console.error(`❌ Lỗi: ${word.word}`, error);
    }
  }
  console.log(`\n🎉 Hoàn thành! Đã nhập ${count} từ vựng`);
  process.exit(0);
}

importVocabulary();