import { describe, expect, it } from "vitest";
import { errorMessage } from "@/lib/errors";
import { nameOrDefault, plural } from "@/lib/format";

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    expect(plural(1, "frame")).toBe("1 frame");
    expect(plural(0, "frame")).toBe("0 frames");
    expect(plural(2, "sheep", "sheep")).toBe("2 sheep");
  });
});

describe("nameOrDefault", () => {
  it("trims, and falls back on blank or missing names", () => {
    expect(nameOrDefault("  Hero ", "Untitled")).toBe("Hero");
    expect(nameOrDefault("   ", "Untitled")).toBe("Untitled");
    expect(nameOrDefault(undefined, "Untitled")).toBe("Untitled");
  });
});

describe("errorMessage", () => {
  it("reads an Error's message and falls back for anything else", () => {
    expect(errorMessage(new Error("Disk full"), "Failed.")).toBe("Disk full");
    expect(errorMessage(new Error(""), "Failed.")).toBe("Failed.");
    expect(errorMessage("nope", "Failed.")).toBe("Failed.");
  });
});
