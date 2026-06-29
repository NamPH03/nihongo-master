import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nihongo Master — Học tiếng Nhật mỗi ngày",
  description: "Lộ trình học tiếng Nhật từ N5 đến N1 với flashcard thông minh, ôn tập ngắt quãng và theo dõi tiến độ mỗi ngày.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Prevent theme flash on reload */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||((!t)&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-page text-tx antialiased">
        {children}
      </body>
    </html>
  );
}
