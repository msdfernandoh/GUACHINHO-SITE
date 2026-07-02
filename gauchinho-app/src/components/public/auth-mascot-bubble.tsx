import { GauchinhoMascotInline } from "@/components/public/gauchinho-mascot-inline";

export function AuthMascotBubble() {
  return (
    <div className="flex justify-center px-4 pb-6">
      <GauchinhoMascotInline context="login" size="sm" />
    </div>
  );
}
