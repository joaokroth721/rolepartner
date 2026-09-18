# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured for this web learning app. Session Replay, Error Tracking, and Support were enabled; health, error-tracking, and support signal sources were enabled; and the browser initialization was updated so it no longer suppresses replay or default survey capture.

Fresh scout configurations and Replay Vision scanners are armed. Findings should begin appearing in the [Self-driving inbox](https://eu.posthog.com/project/278394/inbox) within about 30 minutes once data arrives.

## AI data processing

Approved. The organization-level approval gate was satisfied before setup began.

## GitHub

The PostHog GitHub App was already connected. No GitHub Issues responder was enabled because connected-tool selection was declined.

## Products enabled

| Product | Result | Notes |
| --- | --- | --- |
| Session Replay | enabled | Browser initialization was edited to remove the client-side replay opt-out. |
| Error Tracking | enabled | The browser SDK does not override exception capture. |
| Support | enabled | Tickets will arrive only after an inbound email, inbox, or Slack channel is connected in PostHog. |

## Signal sources

| Source product | Source type | Action |
| --- | --- | --- |
| `signals_scout` | `cross_source_issue` | Enabled by default; no configuration row was needed. |
| `health_checks` | `health_issue` | Enabled (source id `01a0b621-02ca-77b7-a472-176e41aaae4c`). |
| `error_tracking` | `issue_created` | Enabled (source id `01a0b621-02f9-7f2d-a53e-8ce6bad50b1c`). |
| `error_tracking` | `issue_reopened` | Enabled (source id `01a0b621-02f7-7ecc-805f-dfcf72448797`). |
| `error_tracking` | `issue_spiking` | Enabled (source id `01a0b621-0494-737f-84fc-67585bb461e1`). |
| `conversations` | `ticket` | Enabled (source id `01a0b621-04a4-71db-b32d-8e7783e3ca40`). |
| Session Replay | retired source | Deliberately skipped; Replay Vision scanners are its Self-driving route. |

## Connected tools

The connected-tools selector was dismissed, which is treated as opting into none. No external warehouse source or responder was added. GitHub remains connected at the integration level but is **not used** as a Self-driving issue source.

## Scout troop

**Enabled (4):**

| Scout | Why it is active |
| --- | --- |
| General | Watches cross-product patterns and surfaces outside specialist coverage. |
| Product analytics | Covers behavioral regressions in the app's instrumented learning flows. |
| Web analytics | Covers traffic, attribution, and landing-page health for this browser app. |
| Health checks | Prioritizes actionable PostHog instrumentation and setup health issues. |

**Disabled (23):** AI observability, anomaly detection, APM, Conversations, CSP violations, customer analytics, data pipelines, data warehouse, Error Tracking, experiments, feature flags, inbox validation, insight alerts, logs, MCP tool calls, observability gaps, Replay Vision, revenue analytics, Session Replay, skills store, surveys, tasks, and web vitals. These surfaces have no confirmed active use, are covered by a native source or Replay Vision route, or can be enabled later if adopted. Error Tracking is covered by the native responder; Session Replay is covered by the monitors below.

| Run-budget setting | Value |
| --- | --- |
| Maximum runs per day | 100 |
| Runs used today | 0 |
| Runs remaining today | 100 |

Announcement: “Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.”

## Custom scouts

No custom scouts were created. Two candidates were proposed and declined:

- **Conversation practice journey:** would monitor the scenario-to-conversation-to-evaluation completion path and flag a drop at one stage while earlier stages remain stable. It was a domain-specific funnel gap not directly represented by a saved product-analytics flow.
- **Saved-learning progression:** would monitor whether material learners save is later reviewed and mastered, flagging a sustained drop in follow-through. It was a domain loop beyond generic analytics coverage.

If a future custom scout is noisy, set `emit: false` on its configuration in PostHog to change it to dry-run mode.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes concrete findings to the inbox. These are the only setup components that spend Replay Vision quota. Scanner findings arrive at half weight and require corroboration before they are promoted into a report.

| Scanner | Status | Scope | Sampling | Estimate |
| --- | --- | --- | --- | --- |
| Learning flow breakage | created | Recordings that visited the app's single-page route; this covers its state-driven practice, conversation, evaluation, review, and reading completion flows. | Focused, 10% | 0 observations / 0 credits per month until recordings arrive. |
| Rage-click frustration | created | Recordings with rage-click behavior, without a URL restriction, so it independently surfaces concrete interaction friction. | Focused, 10% | 0 observations / 0 credits per month until recordings arrive. |

The organization currently has 2,500 Replay Vision credits remaining and is not exhausted. No recordings were found during setup, so both scanners are armed and will start evaluating recordings as soon as session data arrives. Rate scanner observations from each scanner’s calibration experience after data arrives to improve future recommendations.

## Files changed

| File | Change |
| --- | --- |
| `instrumentation-client.js` | Reads the PostHog host from the environment, removes the session-replay and survey opt-outs, and fails loudly in development when required PostHog configuration is missing. |
| `package.json` | Updated the declared `posthog-js` dependency while restoring the installed package. |
| `package-lock.json` | Updated lockfile resolution for the restored dependency. |
| `.env.local` | Added the configured public PostHog browser key and host environment variables. |
| `posthog-self-driving-report.md` | Created this setup report. |

## Verification

`npm run build` completed successfully after restoring the declared `posthog-js` dependency. The build confirmed both browser imports and the updated initialization compile with the configured environment.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled ticket responder can receive tickets.
- [ ] Generate production session recordings; the Replay Vision scanners cannot observe anything until recordings exist.
- [ ] Review and rate scanner observations after the first scans to calibrate their recommendations.
- [ ] If GitHub Issues, Linear, Jira, Sentry, Zendesk, or another connected tool should create Self-driving work, enable it from the [new data warehouse source page](https://eu.posthog.com/project/278394/pipeline/new/source) and then enable its responder.

## What happens next

The scout coordinator picks up fresh configurations within about 30 minutes. Scout runs draw from the 100-run daily early-access budget, reports cluster in the inbox, and immediately actionable reports can begin coding tasks.
