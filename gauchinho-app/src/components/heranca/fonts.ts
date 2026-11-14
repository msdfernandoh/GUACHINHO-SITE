import { Fraunces } from "next/font/google";

/** Serifada calorosa para os títulos emocionais da página Herança Inteligente. */
export const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["600", "700"],
  variable: "--font-heranca-serif",
  display: "swap",
});
