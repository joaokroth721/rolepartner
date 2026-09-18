// Client-side analytics. Next runs this in the browser only, before React hydrates, so the
// first interactions are captured and posthog-js never enters the Cloudflare Worker bundle.
import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (key && host) {
  posthog.init(key, {
    api_host: host,

    // Opt in to the dated defaults rather than the legacy ones.
    defaults: "2026-08-30",

    // The app is a single route, so this only fires on a hard load. Screens are tracked by the
    // screen_viewed event instead; this stays set so real routes would report without a change.
    capture_pageview: "history_change",
    capture_pageleave: true,

    // Anonymous visitors get no person profile: cheaper, and nothing to delete later.
    person_profiles: "identified_only",

    // The app renders speech transcripts and AI replies inside clickable containers, and
    // autocapture walks the element tree. Element text must never leave the browser.
    mask_all_text: true,
    mask_all_element_attributes: true,
    autocapture: { element_allowlist: ["a", "button"] },

  });
} else if (process.env.NODE_ENV === "development") {
  const missingVariable = key ? "NEXT_PUBLIC_POSTHOG_HOST" : "NEXT_PUBLIC_POSTHOG_KEY";
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
  );
}
