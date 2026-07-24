import { describe, expect, it } from "vitest";
import { isGmailAddress } from "./email";

describe("isGmailAddress", () => {
  it("aceita domínios Gmail", () => {
    expect(isGmailAddress("user@gmail.com")).toBe(true);
    expect(isGmailAddress("User@GoogleMail.com")).toBe(true);
  });

  it("rejeita outros domínios", () => {
    expect(isGmailAddress("user@empresa.com.br")).toBe(false);
    expect(isGmailAddress("")).toBe(false);
  });
});
