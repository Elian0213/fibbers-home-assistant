import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from "@storybook/web-components";
import { beforeAll } from "vitest";

import * as previewAnnotations from "./preview.js";

// Portable-stories setup for Vitest browser mode: compose the a11y addon's
// annotations with our own preview config so every story test picks up the same
// decorators, backgrounds, and the axe a11y gate defined in preview.js.
const project = setProjectAnnotations([a11yAddonAnnotations, previewAnnotations]);

beforeAll(project.beforeAll);
