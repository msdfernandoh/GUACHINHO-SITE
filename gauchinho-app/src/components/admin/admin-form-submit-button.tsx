"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";
import type { ComponentProps } from "react";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

type Props = {
  children?: ReactNode;
  label?: string;
  pendingLabel?: string;
  creating?: boolean;
  createLabel?: string;
  createPendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
};

function SubmitSpinner() {
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden
    />
  );
}

export function AdminFormSubmitButton({
  children,
  label = "Salvar",
  pendingLabel = "Salvando…",
  creating = false,
  createLabel,
  createPendingLabel = "Criando…",
  variant,
  size,
  className,
  formAction,
}: Props) {
  const { pending } = useFormStatus();
  const idleText = children ?? (creating ? (createLabel ?? label) : label);
  const busyText = creating ? createPendingLabel : pendingLabel;

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      formAction={formAction}
      disabled={pending}
      className={cn(
        "min-h-10 transition active:scale-[0.98]",
        !size || size === "md" ? "min-w-[5.5rem]" : "",
        pending && "cursor-not-allowed opacity-70",
        className,
      )}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <SubmitSpinner />
          {busyText}
        </span>
      ) : (
        idleText
      )}
    </Button>
  );
}
