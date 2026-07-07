"use client";

// src/app/(dashboard)/profile/page.tsx
// Trang thông tin cá nhân của người dùng hỗ trợ upload ảnh đại diện (avatar)

import { useEffect, useState, useRef } from "react";
import { auth, db, storage } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import { getProgress, ProgressData } from "@/lib/progress";
import { User, Settings, Shield, Award, Edit3, Save, Camera } from "lucide-react";

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setUserEmail(user.email || "");

      // Lấy thông tin từ Firestore users/{uid}
      const userDocRef = doc(db, "users", user.uid);
      const [userSnap, prog] = await Promise.all([
        getDoc(userDocRef),
        getProgress(user.uid)
      ]);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        setDisplayName(userData.displayName || user.email?.split("@")[0] || "");
        setPhotoURL(userData.photoURL || "");
      } else {
        setDisplayName(user.email?.split("@")[0] || "");
      }

      setProgress(prog);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const handleSaveName = async () => {
    const user = auth.currentUser;
    if (!user || !displayName.trim()) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: displayName.trim()
      });
      setIsEditing(false);
    } catch (e) {
      console.error("Lỗi cập nhật tên:", e);
    } finally {
      setSaving(false);
    }
  };

  // Xử lý upload ảnh đại diện lên Firebase Storage
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const user = auth.currentUser;
    if (!file || !user) return;

    // Chỉ nhận các định dạng ảnh
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh hợp lệ!");
      return;
    }

    setUploading(true);
    try {
      // 1. Tạo Storage reference: avatars/{uid}
      const fileRef = ref(storage, `avatars/${user.uid}`);
      
      // 2. Upload file lên Storage
      const snapshot = await uploadBytes(fileRef, file);
      
      // 3. Lấy Download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // 4. Lưu Download URL vào Firestore document users/{uid}
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: downloadURL
      });
      
      // 5. Cập nhật state UI
      setPhotoURL(downloadURL);
      
      // Refresh trang để cập nhật ảnh trên Navbar đồng bộ
      window.location.reload();
    } catch (err) {
      console.error("Lỗi tải ảnh lên Firebase:", err);
      alert("Có lỗi xảy ra khi tải ảnh lên, vui lòng thử lại!");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Đang tải...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-page pb-20 md:pb-6">
      <Navbar userEmail={userEmail} />

      <div className="max-w-xl mx-auto px-4 py-6">
        
        {/* Tiêu đề trang */}
        <div className="mb-6 animate-fade-up">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            Thông tin cá nhân
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Quản lý tài khoản Nihongo Master của bạn
          </p>
        </div>

        {/* Thẻ User Card */}
        <div className="card p-6 mb-6 animate-fade-up flex flex-col items-center text-center relative overflow-hidden"
             style={{ 
               background: "linear-gradient(135deg, var(--surface), rgba(34, 197, 94, 0.02))"
             }}>
          
          {/* File Input Ẩn */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />

          {/* Avatar dạng hình tròn + Hover để đổi ảnh */}
          <div 
            onClick={handleAvatarClick}
            className="group relative w-20 h-20 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center mb-4 cursor-pointer overflow-hidden transition-all active:scale-95"
          >
            {photoURL ? (
              <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User size={36} className="text-[var(--primary)]" />
            )}
            
            {/* Overlay hover đổi ảnh */}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Camera size={18} className="text-white" />
            </div>
            
            {/* Hiệu ứng loading khi đang upload */}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent border-[var(--primary)] animate-spin" />
              </div>
            )}
          </div>

          <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-faint)] px-2.5 py-0.5 rounded-full bg-neutral-500/10 mb-2">
            Học viên
          </span>

          {/* Tên hiển thị */}
          <div className="w-full max-w-xs flex flex-col items-center gap-2 mb-2">
            {isEditing ? (
              <div className="flex w-full gap-2 mt-1">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input text-center flex-1 text-sm font-semibold py-1.5"
                  placeholder="Nhập tên của bạn..."
                  autoFocus
                />
                <button 
                  onClick={handleSaveName} 
                  disabled={saving}
                  className="btn btn-primary px-3 rounded-xl flex items-center justify-center"
                >
                  <Save size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" style={{ color: "var(--text)" }}>
                  {displayName}
                </h2>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-neutral-500 hover:text-[var(--primary)] transition-colors p-1"
                  title="Đổi tên"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            )}
            <p className="text-xs text-[var(--text-muted)]">{userEmail}</p>
          </div>
        </div>

        {/* Menu cài đặt & tuỳ chọn */}
        <div className="card p-4 space-y-2 animate-fade-up delay-75">
          
          {/* Nút cài đặt (Chưa xử lý tính năng) */}
          <button 
            className="w-full flex items-center justify-between p-3.5 rounded-xl transition-all duration-200 bg-neutral-500/5 hover:bg-neutral-500/10 active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                <Settings size={18} />
              </div>
              <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
                Cài đặt ứng dụng
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Chưa khả dụng</span>
          </button>

          {/* Các mục khác */}
          <div className="w-full flex items-center justify-between p-3.5 rounded-xl bg-neutral-500/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Shield size={18} />
              </div>
              <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
                Bảo mật & Mật khẩu
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">Chính sách bảo mật</span>
          </div>

          <div className="w-full flex items-center justify-between p-3.5 rounded-xl bg-neutral-500/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
                <Award size={18} />
              </div>
              <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
                Thành tích & XP
              </span>
            </div>
            <span className="text-xs font-bold text-[var(--primary)]">
              Streak: {progress?.streak || 0} ngày
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
