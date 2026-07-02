import { Suspense } from "react";
import { PublicFloatingMascot } from "@/components/public/public-floating-mascot";

export function AuthMascotBubble() {
  return (
    <Suspense fallback={null}>
      <PublicFloatingMascot />
    </Suspense>
  );
}
