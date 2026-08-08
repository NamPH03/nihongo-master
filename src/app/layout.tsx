import type { Metadata } from "next";
import SplashScreen from "@/components/ui/SplashScreen";
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
        {/* Synchronize theme and status bar color before paint to prevent splash screen mismatch */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var isDark=t==='dark'||((!t)&&d);var c=isDark?'#0c1410':'#f6fdf8';if(isDark){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}var m=document.getElementById('theme-color-meta');if(m){m.setAttribute('content',c);}}catch(e){}})()`,
          }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#f6fdf8" id="theme-color-meta" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nihongo Master" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-page text-tx antialiased">
        <SplashScreen />
        <div id="app-scroll">{children}</div>
      </body>
    </html>
  );
}
