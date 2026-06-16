"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DREAM_CARDS } from "@/lib/home/home-content";
import { HomeSection } from "./home-section";

export function DreamCardsSection() {
  return (
    <HomeSection
      id="objetivos"
      eyebrow="Escolha seu objetivo"
      title="O caminho certo começa com clareza"
      subtitle="Cada objetivo leva ao simulador, grupos ou vitrine ideal para o seu momento."
      className="relative"
      style={{ background: "var(--brand-blue)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(201,168,76,0.35), transparent)",
        }}
        aria-hidden
      />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {DREAM_CARDS.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.a
              key={card.id}
              href={card.href}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="group relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl p-6 cursor-pointer"
              style={{
                background: "var(--brand-blue-mid)",
                border: "1px solid #1E3A5F",
                transition: "border-color 0.3s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--brand-gold)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#1E3A5F";
              }}
            >
              {/* Number badge */}
              <span
                className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: "rgba(201,168,76,0.12)",
                  color: "var(--brand-gold)",
                  border: "1px solid rgba(201,168,76,0.25)",
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* Icon */}
              <div className="mt-6">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background: "rgba(201,168,76,0.1)",
                    border: "1px solid rgba(201,168,76,0.2)",
                  }}
                >
                  <Icon className="h-7 w-7" style={{ color: "var(--brand-gold)" }} aria-hidden />
                </div>
              </div>

              <h3 className="mt-4 text-xl font-bold text-white">{card.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
                {card.description}
              </p>

              {/* Arrow on hover */}
              <div
                className="mt-4 flex items-center gap-1 text-sm font-semibold opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style={{ color: "var(--brand-gold)" }}
              >
                Explorar
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </motion.a>
          );
        })}
      </div>
    </HomeSection>
  );
}
