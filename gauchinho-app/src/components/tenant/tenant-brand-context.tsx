"use client";

import { createContext, useContext, type ReactNode } from "react";

export type TenantBrandValue = {
  nome: string;
  slug: string;
  logoUrl: string | null;
  corPrimaria: string;
  corSecundaria: string;
  corDestaque: string;
  isGauchinho: boolean;
  isRacon: boolean;
};

const fallback: TenantBrandValue = {
  nome: "Consórcios",
  slug: "",
  logoUrl: null,
  corPrimaria: "#0066cc",
  corSecundaria: "#0c2340",
  corDestaque: "#0099dd",
  isGauchinho: false,
  isRacon: false,
};

const TenantBrandContext = createContext<TenantBrandValue>(fallback);

export function TenantBrandProvider({ value, children }: { value: TenantBrandValue; children: ReactNode }) {
  return <TenantBrandContext.Provider value={value}>{children}</TenantBrandContext.Provider>;
}

export function useTenantBrand() {
  return useContext(TenantBrandContext);
}
