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
        {/* Prevent theme flash on reload */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||((!t)&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      <!-- Viewport: viewport-fit=cover bắt buộc để env(safe-area-inset-top) hoạt động trên iPhone/Android -->
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <!-- black: status bar đục → không cần xử lý safe-area phức tạp, content bắt đầu ngay dưới -->
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Nihongo Master" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-page text-tx antialiased">
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
