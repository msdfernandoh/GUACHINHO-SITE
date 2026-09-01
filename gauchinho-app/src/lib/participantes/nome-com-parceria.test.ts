import { describe, expect, it } from "vitest";
import { nomeComModeloParceria } from "./nome-com-parceria";

describe("nomeComModeloParceria", () => {
  it("coloca o modelo antes do nome", () => {
    expect(nomeComModeloParceria("Ana", ["SDR"])).toBe("SDR · Ana");
    expect(nomeComModeloParceria("Bruno", ["MICROFRANQUIA"])).toBe("Microfranquia · Bruno");
  });
});
