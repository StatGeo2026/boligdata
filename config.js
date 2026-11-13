// Settings for the Boligdata playground.

// Neon database URL WITHOUT user/password, for example
//   "https://ep-cool-name-123456.c-2.eu-central-1.aws.neon.tech/neondb"
// (Neon Console > your project > Connect, then remove "user:password@" and
// everything after "?"). Leave empty to hide the submit button and gallery.
export const NEON_URL = "https://ep-rapid-salad-b9w6r40h.c-7.eu-central-1.aws.neon.tech/neondb";

// webR version (https://docs.r-wasm.org/webr/). Pin it, so the site does not
// change under the students' feet.
export const WEBR_VERSION = "v0.6.0";

// R packages loaded at start-up (each one makes the first load slower).
export const R_PACKAGES = ["ggplot2", "dplyr", "forcats", "mgcv"];
