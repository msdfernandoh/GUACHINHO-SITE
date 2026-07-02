"use client";

import { Suspense } from "react";
import { GauchinhoMascotBubble } from "@/components/public/gauchinho-mascot-bubble";

type Props = {
  disabled?: boolean;
};

function GauchinhoMascotBubbleInner(props: Props) {
  return <GauchinhoMascotBubble avoidBottomRightFab {...props} />;
}

/** Mascote fixo com balão contextual — substitui o ícone flutuante antigo. */
export function PublicFloatingMascot(props: Props) {
  return (
    <Suspense fallback={null}>
      <GauchinhoMascotBubbleInner {...props} />
    </Suspense>
  );
}

export { GauchinhoMascotBubble } from "@/components/public/gauchinho-mascot-bubble";
