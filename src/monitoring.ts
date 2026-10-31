import * as Sentry from "@sentry/react";

/** Sentry project DSN; empty — error reporting is off (local dev). */
const DSN = import.meta.env.VITE_SENTRY_DSN ?? "";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    // Errors only — no performance tracing or session replays.
    tracesSampleRate: 0,
  });
}
