"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  Repeat, 
  BookOpen, 
  Search, 
  BarChart2, 
  ArrowLeft, 
  LogOut,
  Trophy,
  Award
} from "lucide-react";

interface NavbarProps {
  userEmail?: string;
  showBackToDashboard?: boolean;
}

export default function Navbar({ userEmail, showBackToDashboard }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  const navLinks = [
    { href: "/learn",        label: "Học mới",    icon: Sparkles },
    { href: "/review",       label: "Ôn tập",     icon: Repeat },
    { href: "/vocabulary",   label: "Từ vựng",    icon: BookOpen },
    { href: "/dictionary",   label: "Từ điển",    icon: Search },
    { href: "/progress",     label: "Tiến độ",    icon: BarChart2 },
    { href: "/leaderboard",  label: "Xếp hạng",   icon: Trophy },
    { href: "/badges",       label: "Danh hiệu",  icon: Award },
  ];

  return (
    <nav className="navbar border-b" style={{ borderColor: "var(--border-color)", background: "var(--surface)" }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link
          href={showBackToDashboard ? "/dashboard" : (userEmail ? "/dashboard" : "/")}
          className="flex items-center gap-2 group transition-transform active:scale-95"
        >
          <Image src="/icon-192.png" alt="Logo" width={24} height={24} className="rounded-full object-cover transition-transform group-hover:rotate-12 duration-300" />
          <span className="text-base font-bold tracking-tight"
            style={{ color: "var(--text)" }}>
            Nihongo <span style={{ color: "var(--primary)" }}>Master</span>
          </span>
        </Link>

        {/* Center nav links (dashboard pages) */}
        {userEmail && !showBackToDashboard && (
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
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

        {/* Back to dashboard */}
        {showBackToDashboard && (
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm font-medium hover:text-[var(--text)] transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {userEmail && (
            <>
              <span className="hidden sm:block text-xs px-2" style={{ color: "var(--text-faint)" }}>
                {userEmail.split("@")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-ghost text-sm px-3 py-1.5 flex items-center gap-1 text-red-500 hover:bg-red-500/10"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
