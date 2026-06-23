// Định nghĩa kiểu dữ liệu dùng chung trong toàn bộ app

// Thông tin một từ vựng tiếng Nhật
export interface Vocabulary {
  id: string;
  kanji: string; // Chữ Hán, ví dụ: 食べる
  hiragana: string; // Cách đọc, ví dụ: たべる
  meaning: string; // Nghĩa tiếng Việt, ví dụ: ăn
  level: "N5" | "N4" | "N3" | "N2" | "N1"; // Cấp độ JLPT
}

// Thông tin người dùng (sau khi đăng nhập)
export interface User {
  uid: string;
  email: string;
  displayName?: string;
}
