import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("rolagem horizontal do Pipeline CRM", () => {
  it("oferece uma barra superior sincronizada com as colunas do Kanban", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/admin/crm/crm-kanban-board.tsx"),
      "utf8",
    );

    expect(source).toContain("kanbanTopScrollRef");
    expect(source).toContain("hasKanbanHorizontalOverflow");
    expect(source).toContain("crm-kanban-top-scroll");
    expect(source).toContain("syncFromBoard");
    expect(source).toContain("syncFromTop");
    expect(source).toContain("Deslize para navegar pelas colunas");
  });
});
