"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/form-primitives";
import { logoutAction } from "@/app/(auth)/login/actions";

export function AdminHeader({
  nome,
  perfil,
}: {
  nome: string;
  perfil: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right text-sm">
          <p className="font-medium">{nome}</p>
          <p className="text-xs uppercase text-zinc-500">{perfil}</p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            <LogOut className="mr-1 h-4 w-4" />
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}
