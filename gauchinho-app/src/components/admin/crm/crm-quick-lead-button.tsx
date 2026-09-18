"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";
import { CrmQuickLeadModal } from "./crm-quick-lead-modal";

export function CrmQuickLeadButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-blue-600 text-xs font-semibold text-white shadow hover:bg-blue-500"
      >
        <PlusCircle className="h-4 w-4" />
        Novo Lead Rápido
      </Button>

      {open && <CrmQuickLeadModal onClose={() => setOpen(false)} />}
    </>
  );
}
