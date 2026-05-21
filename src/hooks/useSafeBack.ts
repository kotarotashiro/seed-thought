"use client";

import { useRouter } from "next/navigation";

export function useSafeBack(fallback = "/") {
  const router = useRouter();
  return () => {
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push(fallback);
    } else {
      router.back();
    }
  };
}
