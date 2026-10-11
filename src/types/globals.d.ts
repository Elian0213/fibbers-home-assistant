/** Ambient globals Fibbers sets on `window` (the card-picker registry + debug handle). */
interface CustomCardEntry {
  type: string;
  name?: string;
  description?: string;
  preview?: boolean;
  documentationURL?: string;
}

declare global {
  /** package.json `version`, injected by Vite's `define` at build time. */
  // eslint-disable-next-line @typescript-eslint/naming-convention -- define-style build constant
  const __FIBBERS_VERSION__: string;

  interface Window {
    /** Home Assistant's custom-card picker registry. */
    customCards?: CustomCardEntry[];
    /** Debug/preview handle exposed by the entry point. */
    FIBBERS?: Record<string, unknown>;
  }
}

export {};
