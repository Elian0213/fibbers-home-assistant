/* Unit tests for the cva class recipes. Class strings are compared as SETS —
 * cva's emit order is an implementation detail, the utilities are not. */
import { describe, expect, test } from "bun:test";

import { card, cx, iconBox, sectionLabel } from "./variants";

const setOf = (s: string): Set<string> =>
  new Set(s.split(/\s+/).filter(Boolean));

describe("card", () => {
  test("default is the house surface with p-[13px]", () => {
    expect(setOf(card())).toEqual(
      setOf("rounded-[14px] border border-line bg-card p-[13px]"),
    );
  });

  test("pad variants swap only the padding", () => {
    expect(setOf(card({ pad: "sm" }))).toEqual(
      setOf("rounded-[14px] border border-line bg-card p-3"),
    );
    expect(setOf(card({ pad: "lg" }))).toEqual(
      setOf("rounded-[14px] border border-line bg-card p-[15px]"),
    );
  });

  test("pad none drops padding entirely", () => {
    expect(setOf(card({ pad: "none" }))).toEqual(
      setOf("rounded-[14px] border border-line bg-card"),
    );
  });
});

describe("iconBox", () => {
  test("default is a 7-unit accent box with flex-none", () => {
    expect(setOf(iconBox())).toEqual(
      setOf(
        "flex items-center justify-center rounded-lg h-7 w-7 flex-none bg-accentbg text-accent",
      ),
    );
  });

  test("tone muted swaps the accent pair for card2/muted", () => {
    const classes = setOf(iconBox({ tone: "muted" }));
    expect(classes.has("bg-card2")).toBe(true);
    expect(classes.has("text-muted")).toBe(true);
    expect(classes.has("bg-accentbg")).toBe(false);
    expect(classes.has("text-accent")).toBe(false);
  });

  test("tone plain carries no background or text colour", () => {
    expect(setOf(iconBox({ tone: "plain" }))).toEqual(
      setOf("flex items-center justify-center rounded-lg h-7 w-7 flex-none"),
    );
  });

  test("size picks the matching h/w pair", () => {
    expect(setOf(iconBox({ size: 9 })).has("h-9")).toBe(true);
    expect(setOf(iconBox({ size: 9 })).has("w-9")).toBe(true);
    expect(setOf(iconBox({ size: 8 })).has("h-8")).toBe(true);
  });

  test("flexNone false drops flex-none", () => {
    const classes = setOf(iconBox({ flexNone: false }));
    expect(classes.has("flex-none")).toBe(false);
    expect(classes.has("flex")).toBe(true); // the base display class stays
  });
});

describe("sectionLabel", () => {
  test("default uses the wide 0.08em tracking", () => {
    expect(setOf(sectionLabel())).toEqual(
      setOf("text-[10px] font-semibold uppercase text-muted tracking-[0.08em]"),
    );
  });

  test("tight swaps to 0.06em", () => {
    const classes = setOf(sectionLabel({ tracking: "tight" }));
    expect(classes.has("tracking-[0.06em]")).toBe(true);
    expect(classes.has("tracking-[0.08em]")).toBe(false);
  });
});

describe("cx", () => {
  test("joins class strings with a space", () => {
    expect(cx("a", "b", "c")).toBe("a b c");
  });

  test("drops falsy entries", () => {
    expect(cx("a", false, null, undefined, "", 0, "b")).toBe("a b");
  });

  test("no arguments yields the empty string", () => {
    expect(cx()).toBe("");
  });
});
