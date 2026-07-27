// src/app/(dashboard)/layout.tsx
// Layout cho tất cả trang dashboard (đã đăng nhập)
// PushNotificationSetup chỉ chạy trong các route này, không chạy trên /login, /register

import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PushNotificationSetup />
      {children}
    </>
  );
}
