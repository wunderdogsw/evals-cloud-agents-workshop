import { describe, expect, it } from "vitest";
import { mockClassify } from "../../src/classify.ts";

describe("temporary site power", () => {
  it("goes to 3200", () => expect(mockClassify({ description: "Sähköliittymä työmaalle, väliaikainen" }).costCode).toBe("3200"));
  it("temporary water too", () => expect(mockClassify({ description: "Väliaikainen vesiliittymä työmaalle" }).costCode).toBe("3200"));
  it("normal cable stays electrical", () => expect(mockClassify({ description: "MMJ 3x2,5S kaapeli" }).costCode).toBe("2300"));
  it("lighting stays electrical", () => expect(mockClassify({ description: "LED-valaisin 40W" }).costCode).toBe("2300"));
});
