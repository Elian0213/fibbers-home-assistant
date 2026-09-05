/** Ambient globals Fibbers sets on `window` (the card-picker registry + debug handle). */
interface CustomCardEntry {
  type: string;
  name?: string;
  description?: string;
  preview?: boolean;
  documentationURL?: string;
}

declare global {
  interface Window {
    /** Home Assistant's custom-card picker registry. */
    customCards?: CustomCardEntry[];
    /** Debug/preview handle exposed by the entry point. */
    FIBBERS?: Record<string, unknown>;
  }
}

export {};
