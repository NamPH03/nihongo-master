// src/lib/auth.ts
// Tất cả logic đăng nhập / đăng ký / đăng xuất gom tại đây
// Các trang khác chỉ gọi hàm, không cần import Firebase trực tiếp

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

// Kiểu kết quả trả về — success: true = thành công, false = có lỗi kèm message tiếng Việt
export type AuthResult = { success: true } | { success: false; error: string };

// Dữ liệu lưu vào Firestore collection "users"
interface UserProfileData {
  email: string | null;
  displayName?: string;
  photoURL?: string | null;
  createdAt?: string;
}

// Chuyển mã lỗi Firebase sang tiếng Việt dễ hiểu
function parseAuthError(code?: string): string {
  switch (code) {
    case "auth/user-not-found":
      return "Email này chưa được đăng ký.";
    case "auth/wrong-password":
      return "Mật khẩu không đúng.";
    case "auth/invalid-credential":
      return "Email hoặc mật khẩu không đúng.";
    case "auth/email-already-in-use":
      return "Email này đã được đăng ký.";
    case "auth/invalid-email":
      return "Email không hợp lệ.";
    case "auth/weak-password":
      return "Mật khẩu quá yếu, cần ít nhất 6 ký tự.";
    case "auth/too-many-requests":
      return "Thử quá nhiều lần, vui lòng đợi vài phút rồi thử lại.";
    case "auth/popup-closed-by-user":
      return "Bạn đã đóng cửa sổ đăng nhập Google.";
    case "auth/popup-blocked":
      return "Trình duyệt chặn popup. Hãy cho phép popup rồi thử lại.";
    case "auth/requires-recent-login":
      return "Phiên đăng nhập đã cũ. Vui lòng đăng xuất và đăng nhập lại.";
    default:
      return "Có lỗi xảy ra, thử lại nhé.";
  }
}

// Lưu / cập nhật thông tin user vào Firestore (dùng cho leaderboard, profile)
async function saveUserProfile(uid: string, data: UserProfileData): Promise<void> {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// Kiểm tra user đăng nhập bằng email/password hay Google
export function hasPasswordProvider(user: User): boolean {
  return user.providerData.some((p) => p.providerId === "password");
}

// ─── ĐĂNG NHẬP EMAIL ───────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await saveUserProfile(cred.user.uid, {
      email: cred.user.email,
      displayName: email.split("@")[0],
    });
    return { success: true };
  } catch (err: unknown) {
    const e = err as { code?: string };
    return { success: false, error: parseAuthError(e.code) };
  }
}

// ─── ĐĂNG KÝ EMAIL ─────────────────────────────────────────────
export async function register(
  email: string,
  password: string,
  confirmPassword: string
): Promise<AuthResult> {
  if (password !== confirmPassword) {
    return { success: false, error: "Mật khẩu xác nhận không khớp." };
  }
  if (password.length < 6) {
    return { success: false, error: "Mật khẩu phải có ít nhất 6 ký tự." };
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await saveUserProfile(cred.user.uid, {
      email: cred.user.email,
      displayName: email.split("@")[0],
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: unknown) {
    const e = err as { code?: string };
    return { success: false, error: parseAuthError(e.code) };
  }
}

// ─── ĐĂNG NHẬP GOOGLE ──────────────────────────────────────────
export async function loginWithGoogle(): Promise<AuthResult> {
  const provider = new GoogleAuthProvider();
  // Luôn hiện chọn tài khoản Google
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const cred = await signInWithPopup(auth, provider);
    await saveUserProfile(cred.user.uid, {
      email: cred.user.email,
      displayName: cred.user.displayName || cred.user.email?.split("@")[0] || "Học viên",
      photoURL: cred.user.photoURL,
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: unknown) {
    const e = err as { code?: string };
    return { success: false, error: parseAuthError(e.code) };
  }
}

// ─── QUÊN MẬT KHẨU ─────────────────────────────────────────────
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!email.trim()) {
    return { success: false, error: "Vui lòng nhập email của bạn." };
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (err: unknown) {
    const e = err as { code?: string };
    return { success: false, error: parseAuthError(e.code) };
  }
}

// ─── ĐỔI MẬT KHẨU (trong Profile) ──────────────────────────────
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string
): Promise<AuthResult> {
  const user = auth.currentUser;

  if (!user || !user.email) {
    return { success: false, error: "Bạn chưa đăng nhập." };
  }

  if (!hasPasswordProvider(user)) {
    return {
      success: false,
      error: "Tài khoản đăng nhập bằng Google — không cần đổi mật khẩu tại đây.",
    };
  }

  if (newPassword !== confirmNewPassword) {
    return { success: false, error: "Mật khẩu mới và xác nhận không khớp." };
  }

  if (newPassword.length < 6) {
    return { success: false, error: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  }

  try {
    // Xác minh lại mật khẩu hiện tại trước khi đổi (bảo mật Firebase yêu cầu)
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    return { success: true };
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
      return { success: false, error: "Mật khẩu hiện tại không đúng." };
    }
    return { success: false, error: parseAuthError(e.code) };
  }
}

// ─── ĐĂNG XUẤT ─────────────────────────────────────────────────
export async function logout(): Promise<void> {
  await signOut(auth);
}

// ─── THEO DÕI TRẠNG THÁI ĐĂNG NHẬP ─────────────────────────────
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Lấy user hiện tại (có thể null nếu chưa đăng nhập)
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
