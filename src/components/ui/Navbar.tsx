"use client";

// src/components/ui/Navbar.tsx
// Nâng cấp: Tự động lấy trạng thái đăng nhập để Bottom Navigation Bar (5 cột) luôn hiển thị ở mọi trang

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { onAuthChange } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { 
  Sparkles, 
  Repeat, 
  Search, 
  Trophy,
  BookOpen,
  User
} from "lucide-react";

interface NavbarProps {
  userEmail?: string;
}

export default function Navbar({}: NavbarProps) {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [photoURL, setPhotoURL] = useState<string>("");

  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const unsubAuth = onAuthChange((user) => {
      // Hủy listener Firestore cũ khi auth state thay đổi
      if (unsubFirestore) { unsubFirestore(); unsubFirestore = null; }

      if (user) {
        setIsLoggedIn(true);
        // Lắng nghe real-time → avatar cập nhật ngay khi user đổi ảnh
        unsubFirestore = onSnapshot(
          doc(db, "users", user.uid),
          (snap) => { if (snap.exists()) setPhotoURL(snap.data().photoURL || ""); },
          (err) => console.error("Navbar onSnapshot lỗi:", err)
        );
      } else {
        setIsLoggedIn(false);
        setPhotoURL("");
      }
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);


  // Menu trên Desktop (5 trang chính)
  const desktopLinks = [
    { href: "/dictionary",   label: "Từ điển",    icon: Search },
    { href: "/learn",        label: "Học mới",    icon: Sparkles },
    { href: "/dashboard",    label: "Ôn tập",     icon: Repeat },
    { href: "/vocabulary",   label: "Sổ tay",     icon: BookOpen },
    { href: "/leaderboard",  label: "Xếp hạng",   icon: Trophy },
  ];

  // Menu dưới chân trên Mobile — 5 tab chính (Giống Desktop: Từ điển, Học mới, Ôn tập, Sổ tay, Xếp hạng)
  const mobileLinks = [
    { href: "/dictionary",   label: "Từ điển",   icon: Search },
    { href: "/learn",        label: "Học mới",   icon: Sparkles },
    { href: "/dashboard",    label: "Ôn tập",    icon: Repeat },
    { href: "/vocabulary",   label: "Sổ tay",    icon: BookOpen },
    { href: "/leaderboard",  label: "Xếp hạng",  icon: Trophy },
  ];

  return (
    <>
      {/* Top Navbar: Thêm padding-top safe-area cho iPhone để phủ kín status bar */}
      <nav className="navbar border-b sticky top-0 z-40" 
           style={{ 
             borderColor: "var(--border-color)", 
             background: "var(--surface)", 
             backdropFilter: "blur(8px)",
             paddingTop: "calc(env(safe-area-inset-top) + 2px)", // Phủ kín status bar trên iPhone
           }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link
            href={isLoggedIn ? "/dashboard" : "/"}
            className="flex items-center gap-2 group transition-transform active:scale-95"
          >
            <Image src="/icon-512.png" alt="Logo" width={28} height={28} className="rounded-xl object-cover transition-transform group-hover:rotate-12 duration-300" />
            <span className="text-base font-bold tracking-tight"
              style={{ color: "var(--text)" }}>
              Nihongo <span style={{ color: "var(--primary)" }}>Master</span>
            </span>
          </Link>

          {/* Links cho Desktop */}
          {isLoggedIn && (
            <div className="hidden md:flex items-center gap-1">
              {desktopLinks.map((link) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                      transition-all duration-200 ease-spring
                      ${isActive
                        ? "bg-[var(--primary)] text-[#0d1f14]"
                        : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Nút thông tin tài khoản: Ưu tiên hiển thị Avatar thật của user */}
            {isLoggedIn && (
              <Link 
                href="/profile"
                className={`w-9 h-9 rounded-xl overflow-hidden transition-all duration-200 hover:bg-[var(--surface-2)] active:scale-95 flex items-center justify-center border
                  ${pathname === '/profile' ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                title="Thông tin tài khoản"
              >
                {photoURL ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </Link>
            )}
          </div>

        </div>
      </nav>

      {/* Bottom Navigation Bar (Chỉ hiển thị trên Mobile khi đã đăng nhập) */}
      {isLoggedIn && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t"
             style={{ 
               borderColor: "var(--border-color)", 
               background: "var(--nav-bg)", 
               backdropFilter: "blur(12px)",
               paddingBottom: "calc(env(safe-area-inset-bottom) + 6px)", // Thêm safe area cho iPhone
             }}>
          <div className="flex justify-around items-center h-16 px-2">
            {mobileLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-label={link.label}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 active:scale-90
                    ${isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}
                >
                  <div className={`p-1.5 rounded-xl transition-all duration-200 
                    ${isActive ? "bg-[var(--primary)]/10 text-[var(--primary)]" : ""}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold mt-0.5 tracking-tight"
                        style={{ color: isActive ? "var(--primary)" : "var(--text-muted)" }}>
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Thêm khoảng trống padding-bottom trên mobile để không bị đè bởi BottomNav */}
      {isLoggedIn && (
        <style jsx global>{`
          @media (max-width: 768px) {
            body {
              padding-bottom: calc(env(safe-area-inset-bottom) + 5.2rem) !important;
            }
          }
        `}</style>
      )}
    </>
  );
}
