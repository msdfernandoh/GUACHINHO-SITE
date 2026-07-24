import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { markGoogleConnected } from "./token-store";

describe("markGoogleConnected", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cenário 8: grava google_calendar_email distinto do login", async () => {
    await markGoogleConnected("user-1", "outroemail@gmail.com");

    expect(mockFrom).toHaveBeenCalledWith("usuarios");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        google_calendar_email: "outroemail@gmail.com",
        google_calendar_connected_at: expect.any(String),
      }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "user-1");
  });
});
