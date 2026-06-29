"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved === "dark" || (!saved && prefersDark);
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  if (!mounted) return <div className="w-9 h-9" />;

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
      className={`relative w-9 h-9 rounded-xl flex items-center justify-center
        bg-surface-2 border border-theme
        hover:border-[var(--border-strong)] hover:bg-surface-3
        transition-all duration-200 ease-spring group ${className}`}
    >
      {/* Sun icon */}
      <svg
        className={`absolute w-4 h-4 transition-all duration-300
          ${isDark ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
        style={{ color: "var(--primary)" }}
      >
        <circle cx="12" cy="12" r="4" strokeWidth={2} />
        <path strokeLinecap="round" strokeWidth={2}
          d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>

      {/* Moon icon */}
      <svg
        className={`absolute w-4 h-4 transition-all duration-300
          ${isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
        style={{ color: "var(--primary)" }}
      >
        <path strokeLinecap="round" strokeWidth={2}
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}
