/* ================================================================== *
 * variants — cva class recipes for the shells every card repeats. One source for
 * each recurring class set (the card surface, the icon box, section labels), with
 * state expressed as typed variants instead of ternaries inside class strings.
 * Recipes return class strings only — markup lives in shells.ts or the card.
 * NOTE: keep every utility a literal string; Tailwind's scanner can't see
 * constructed class names.
 * ================================================================== */
import { cva, cx, type VariantProps } from "class-variance-authority";

export { cx };

/** The card surface — `rounded-[14px] border border-line bg-card` + padding. */
export const card = cva("rounded-[14px] border border-line bg-card", {
  variants: {
    pad: {
      md: "p-[13px]", // the house default (18 call sites)
      sm: "p-3",
      lg: "p-[15px]",
      none: "",
    },
  },
  defaultVariants: { pad: "md" },
});

/** The rounded icon box that leads most rows/tiles. `tone` carries the on/off state. */
export const iconBox = cva("flex items-center justify-center rounded-lg", {
  variants: {
    size: {
      7: "h-7 w-7",
      8: "h-8 w-8",
      9: "h-9 w-9",
    },
    tone: {
      accent: "bg-accentbg text-accent", // lit up
      muted: "bg-card2 text-muted", // off / idle
      plain: "",
    },
    flexNone: {
      true: "flex-none",
      false: "",
    },
  },
  defaultVariants: { size: 7, tone: "accent", flexNone: true },
});

/** Uppercase section label. Most sites use the wide tracking; a few the tight one. */
export const sectionLabel = cva(
  "text-[10px] font-semibold uppercase text-muted",
  {
    variants: {
      tracking: {
        wide: "tracking-[0.08em]",
        tight: "tracking-[0.06em]",
      },
    },
    defaultVariants: { tracking: "wide" },
  },
);

export type CardVariants = VariantProps<typeof card>;
export type IconBoxVariants = VariantProps<typeof iconBox>;
export type SectionLabelVariants = VariantProps<typeof sectionLabel>;
