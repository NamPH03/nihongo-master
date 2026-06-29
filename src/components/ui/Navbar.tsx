"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface NavbarProps {
  userEmail?: string;
  showBackToDashboard?: boolean;
}

const navLinks = [
  { href: "/learn",      label: "Học mới",    icon: "🎯" },
  { href: "/review",     label: "Ôn tập",     icon: "🔁" },
  { href: "/vocabulary", label: "Từ vựng",    icon: "📚" },
  { href: "/dictionary", label: "Từ điển",    icon: "📖" },
  { href: "/progress",   label: "Tiến độ",    icon: "📈" },
];

export default function Navbar({ userEmail, showBackToDashboard }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <nav className="navbar">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link
          href={userEmail ? "/dashboard" : "/"}
          className="flex items-center gap-2 group"
        >
          <span className="text-xl">🌿</span>
          <span className="text-base font-bold tracking-tight"
            style={{ color: "var(--primary)" }}>
            Nihongo Master
          </span>
        </Link>

        {/* Center nav links (dashboard pages) */}
        {userEmail && !showBackToDashboard && (
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                    transition-all duration-200 ease-spring
                    ${isActive
                      ? "bg-[var(--primary)] text-[#0d1f14]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-surface-2"
                    }`}
                >
                  <span className="text-xs">{link.icon}</span>
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
            className="flex items-center gap-1.5 text-sm font-medium text-muted hover:text-tx transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {userEmail && (
            <>
              <span className="hidden sm:block text-xs text-muted px-2">
                {userEmail.split("@")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="btn btn-ghost text-sm px-3 py-1.5"
              >
                Đăng xuất
              </button>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
