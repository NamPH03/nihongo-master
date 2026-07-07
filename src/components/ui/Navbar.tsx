"use client";

// src/components/ui/Navbar.tsx
// Nâng cấp: Tự động lấy trạng thái đăng nhập để Bottom Navigation Bar (5 cột) luôn hiển thị ở mọi trang

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  Repeat, 
  Search, 
  BarChart2, 
  LogOut,
  Trophy,
  BookOpen
} from "lucide-react";

interface NavbarProps {
  userEmail?: string;
}

export default function Navbar({ userEmail: propEmail }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    if (propEmail) {
      setCurrentUserEmail(propEmail);
      setIsLoggedIn(true);
      return;
    }

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserEmail(user.email || "User");
        setIsLoggedIn(true);
      } else {
        setCurrentUserEmail("");
        setIsLoggedIn(false);
      }
    });
    return () => unsub();
  }, [propEmail]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  // Menu trên Desktop (Đầy đủ)
  const desktopLinks = [
    { href: "/dictionary",   label: "Từ điển",    icon: Search },
    { href: "/learn",        label: "Học mới",    icon: Sparkles },
    { href: "/dashboard",    label: "Ôn tập",     icon: Repeat },
    { href: "/vocabulary",   label: "Kho từ",     icon: BookOpen },
    { href: "/leaderboard",  label: "Xếp hạng",   icon: Trophy },
    { href: "/progress",     label: "Tiến độ",    icon: BarChart2 },
  ];

  // Menu dưới chân trên Mobile (Đúng 5 cột theo yêu cầu, luôn luôn xuất hiện)
  const mobileLinks = [
    { href: "/dictionary",   label: "Từ điển",    icon: Search },
    { href: "/learn",        label: "Học mới",    icon: Sparkles },
    { href: "/dashboard",    label: "Ôn tập",     icon: Repeat },
    { href: "/leaderboard",  label: "Xếp hạng",   icon: Trophy },
    { href: "/progress",     label: "Tiến độ",    icon: BarChart2 },
  ];

  return (
    <>
      {/* Top Navbar */}
      <nav className="navbar border-b sticky top-0 z-40" style={{ borderColor: "var(--border-color)", background: "var(--surface)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link
            href={isLoggedIn ? "/dashboard" : "/"}
            className="flex items-center gap-2 group transition-transform active:scale-95"
          >
            <Image src="/icon-192.png" alt="Logo" width={24} height={24} className="rounded-full object-cover transition-transform group-hover:rotate-12 duration-300" />
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

            {isLoggedIn && (
              <>
                <span className="hidden sm:block text-xs px-2" style={{ color: "var(--text-faint)" }}>
                  {currentUserEmail.split("@")[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="btn btn-ghost text-sm px-3 py-1.5 flex items-center gap-1 text-red-500 hover:bg-red-500/10 rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </>
            )}
          </div>

        </div>
      </nav>

      {/* Bottom Navigation Bar (Chỉ hiển thị trên Mobile khi đã đăng nhập) */}
      {isLoggedIn && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t pb-safe"
             style={{ 
               borderColor: "var(--border-color)", 
               background: "rgba(12, 20, 16, 0.85)", 
               backdropFilter: "blur(12px)" 
             }}>
          <div className="flex justify-around items-center h-16 px-2">
            {mobileLinks.map((link) => {
              // isActive nếu đường dẫn khớp (hoặc khi đang ở trang /review, /learn v.v..)
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-2 transition-all duration-200 active:scale-90
                    ${isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`}
                >
                  <div className={`p-1.5 rounded-xl transition-all duration-200 
                    ${isActive ? "bg-[var(--primary)]/10 text-[var(--primary)]" : ""}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-semibold mt-0.5 tracking-tight">
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
              padding-bottom: 4.5rem !important;
            }
          }
        `}</style>
      )}
    </>
  );
}
