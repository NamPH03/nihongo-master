// src/components/layout/Header.tsx
export default function Header() {
  return (
    <header className="navbar">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌿</span>
          <span className="font-bold text-base" style={{ color: "var(--primary)" }}>
            Nihongo Master
          </span>
        </div>
      </div>
    </header>
  );
}
