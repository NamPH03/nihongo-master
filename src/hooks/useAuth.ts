"use client";

// Hook tiện lợi — component gọi useAuth() để biết user đang đăng nhập hay chưa

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthChange } from "@/lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading, isLoggedIn: !!user };
}
