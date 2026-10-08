import * as path from "path";
import type { Font } from "@react-pdf/renderer";

type InvoiceFontStore = Pick<typeof Font, "clear" | "register" | "load">;
let renderTail: Promise<void> = Promise.resolve();

/**
 * Fontkit caches glyph objects across documents, including glyphs first loaded
 * without source codepoints during PDF subsetting. Reusing those objects can
 * break textkit's Arabic character-to-glyph mapping on the next document.
 * Use fresh font sources for each receipt without changing text or bidi rules.
 * React-PDF's font store is global, so all receipt rendering must share this
 * gate until the Blob has finished. Both queued and on-demand PDFs use it.
 * Upstream context: https://github.com/diegomura/react-pdf/issues/3404
 */
export async function withFreshInvoiceFonts<T>(
  font: InvoiceFontStore,
  fontsDir: string,
  render: () => Promise<T>,
): Promise<T> {
  const previous = renderTail;
  let release!: () => void;
  renderTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    // reset() leaves FontSource.loadResultPromise cached; clear + register
    // creates genuinely new Fontkit instances instead.
    font.clear();
    // React-PDF adds Helvetica as its fallback even when the page specifies
    // an Arabic font. clear() also removes its built-in registrations.
    font.register({
      family: "Helvetica",
      fonts: [
        { src: "Helvetica" },
        { src: "Helvetica-Bold", fontWeight: "bold" },
        { src: "Helvetica-Oblique", fontStyle: "italic" },
        {
          src: "Helvetica-BoldOblique",
          fontWeight: "bold",
          fontStyle: "italic",
        },
      ],
    });
    font.register({
      family: "IBMPlexArabic",
      fonts: [
        { src: path.join(fontsDir, "IBMPlexSansArabic-Regular.ttf") },
        {
          src: path.join(fontsDir, "IBMPlexSansArabic-Bold.ttf"),
          fontWeight: "bold",
        },
      ],
    });
    // The normal FontStore constructor preloads this fallback. Reproduce
    // that step after clear() so unsupported Unicode still has a font.
    await Promise.all(
      [400, 700].flatMap((fontWeight) =>
        (["normal", "italic"] as const).map((fontStyle) =>
          font.load({
            fontFamily: "Helvetica",
            fontWeight,
            fontStyle,
          }),
        ),
      ),
    );
    return await render();
  } finally {
    release();
  }
}
