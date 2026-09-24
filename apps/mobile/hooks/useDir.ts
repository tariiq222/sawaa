import { createContext, useContext } from "react";

export type Locale = "ar" | "en";

export type DirState = {
  locale: Locale;
  isRTL: boolean;
  /**
   * Use for ROWS of localized children. The root layout basis is LTR on all
   * platforms; this helper performs the single locale-dependent mirror.
   */
  row: "row" | "row-reverse";
  /** Opposite of `row` — for rare cases (LTR numbers inside RTL, etc.). */
  rowReverse: "row" | "row-reverse";
  /** Cross-axis alignment hugging the LOGICAL START edge. */
  alignStart: "flex-start" | "flex-end";
  /** Cross-axis alignment hugging the LOGICAL END edge. */
  alignEnd: "flex-start" | "flex-end";
  /** textAlign for localized prose. */
  textAlign: "left" | "right";
  /** writingDirection for Text nodes. */
  writingDirection: "ltr" | "rtl";
  /** scaleX for directional icons (chevrons, arrows). */
  iconScaleX: 1 | -1;
};

const build = (locale: Locale): DirState => {
  const isRTL = locale === "ar";
  return {
    locale,
    isRTL,
    row: isRTL ? "row-reverse" : "row",
    rowReverse: isRTL ? "row" : "row-reverse",
    alignStart: isRTL ? "flex-end" : "flex-start",
    alignEnd: isRTL ? "flex-start" : "flex-end",
    textAlign: isRTL ? "right" : "left",
    writingDirection: isRTL ? "rtl" : "ltr",
    iconScaleX: isRTL ? -1 : 1,
  };
};

export const DirContext = createContext<DirState>(build("ar"));

export const buildDirState = build;

export const useDir = () => useContext(DirContext);
