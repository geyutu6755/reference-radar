# Public Beta Feedback Plan

How to collect real-user feedback for the v1.0.x public beta — executable,
measurable, and free of spam or fabricated adoption claims.

## Goals

1. Learn how the checker behaves on **real, natural papers** (the external
   corpus is synthetic; see `docs/external-validation.md` § Coverage limits).
2. Find parsing misses and false positives the synthetic corpus cannot cover.
3. Prioritize the roadmap (v1.1 author–year support, v1.2 scope) by demand.

## Channels

| Channel | Purpose | Action |
|---|---|---|
| GitHub Issues (templates: bug / rule source / usage question) | defect & accuracy reports | triaged weekly; label `corpus-candidate` when a reproducible sample arrives |
| GitHub Discussions (Q&A + Ideas) | usage questions & feature requests | enabled; answered in zh/en |
| Rule-source issue template | clause disputes with citations | feeds `docs/rule-coverage.md` updates |

## What we ask users to share

- The **ruleId + detail text** of any wrong finding (auto-copied in every report);
- A **minimal .docx fragment** that reproduces it (with private content removed);
- Browser and OS version.

We never ask users to submit papers themselves, and the app cannot upload them.

## Metrics we will track (honest ones only)

- Number of confirmed defect reports per release (issue labels);
- Corpus growth: every reproducible report becomes a new annotated corpus case
  (precision/recall re-measured per `docs/external-validation.md`);
- Median triage response time.

We do **not** publish download/user counts until there is a real measurement
source, and we do not send unsolicited promotion of any kind.

## Weekly triage checklist (maintainer)

1. Review new issues; label (`bug`, `rules`, `corpus-candidate`, `ux`).
2. Convert reproducible parsing/accuracy reports into corpus cases with hand
   annotations; add regression tests.
3. Update `docs/rule-coverage.md` and this file when scope changes.
4. Close the loop: comment on the issue with the release that fixes it.
