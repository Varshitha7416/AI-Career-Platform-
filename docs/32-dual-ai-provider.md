# 32 - Dual AI provider (Gemini primary, Groq free-tier fallback)

Budget rule: **Rs 0**. Only Groq's FREE tier is intended; nothing here adds a payment method, buys credits or picks a paid model. xAI Grok is not used and there is no `XAI_API_KEY`.

## Architecture (`server/services/ai/`)
- `providers/geminiProvider.js`: the original Gemini transport, retries and JSON parsing, moved from `config/gemini.js` (model/env unchanged). Mapped errors gained `aiClass`.
- `providers/groqProvider.js`: `fetch` to `{GROQ_BASE_URL}/chat/completions`, Bearer auth, `response_format: json_object` for JSON, 30 s timeout, pre-flight size guard (`GROQ_MAX_INPUT_CHARS`), reads `retry-after` and `x-ratelimit-*`.
- `errors.js`: classes quota / transient / auth / config / unconfigured / bad_output / bad_request / input / oversize, and `redact()`.
- `breaker.js`: closed -> open -> half-open -> closed. Quota opens at once (honours retry-after), transient after N consecutive failures, auth/config for a long cooldown.
- `manager.js`: validates input, calls the primary, on a recoverable failure makes ONE attempt on the secondary, otherwise returns the primary's error in the unchanged `AI_*` contract. `config/gemini.js` re-exports it, so the four callers are untouched.
- `GET /api/admin/ai/health` (behind `protect` + `requireAdmin`): passive status from real traffic; no AI calls, no keys, no prompts.

## Fallback rules
| Situation | Behaviour |
|---|---|
| quota / 429, 5xx, timeout, network | one attempt on Groq |
| Gemini returns invalid JSON after its own retry | one attempt on Groq |
| invalid key / unknown model | one attempt on the other provider, the bad one is paused (no loop) |
| 400 / 422 malformed request, empty or oversized input | no fallback |
| prompt larger than `GROQ_MAX_INPUT_CHARS` | Groq skipped, original error returned |
| both fail | the primary's error (e.g. `AI_QUOTA`), or Groq's if Gemini has no key |

One user request = one `consumeAiCall`: the fallback happens inside the single `generateJSON` call.

## Privacy gate (important)
The fallback is OFF by default. It activates only when `GROQ_API_KEY` is set **and** `GROQ_PRIVACY_ACK=true`. Set the acknowledgement only after the Privacy Policy is updated (draft below) and you have accepted Groq's terms.

What Groq's own pages say (read via docs, not verified by a contract review; re-read before relying on them):
- Inference inputs/outputs are not retained by default; abuse/reliability logs up to 30 days; Zero Data Retention can be enabled in Data Controls (the default state for a new account is NOT stated). **ZDR could not be verified for our account, so it is treated as NOT enabled.**
- Services Agreement 4.2: Groq may not use Inputs/Outputs to train models unless the customer permits it. Free-vs-paid difference not stated.
- Data is processed in the United States; sub-processors are listed at trust.groq.com/subprocessors (not reviewed).
- The customer is responsible for having the notices/consents needed to send personal data.
- NOT stated on the pages read: whether a card is needed for a free account, and what happens at the free limit. Never add a payment method; if asked, stop.

### Privacy Policy and Terms: IMPLEMENTED (2026-11-27)
`client/src/pages/Privacy.jsx` now discloses, in the "AI processing" section and related sections:
- all four AI features (resume analysis, cover letters, skill gap analysis, learning roadmaps) and exactly what each prompt builder sends (resume text up to 30,000 characters, job details, account name and free-text instructions/facts for cover letters, manual-mode skill inputs, and only target role + skill names for roadmaps);
- Google Gemini as the primary provider on the **free tier**, whose terms may allow submitted content to be used to improve Google's products (stated as "may", never denied);
- Groq as a backup, used only if switched on and only after a Gemini quota/rate-limit/temporary error/timeout/network failure/invalid-JSON answer, one attempt, same prompt; oversized requests are not sent;
- Groq's published handling: no default retention of inference content, abuse/reliability logs up to 30 days, US storage, sub-processors possibly in other countries, a no-training statement qualified as "not independently verified for our plan";
- **Zero Data Retention is explicitly NOT confirmed or enabled**, and the policy says not to assume it;
- account deletion cannot recall content already sent to Google or Groq.
The "Your choices and deletion" section now documents the real Account Data features (JSON export, sign out everywhere, immediate deletion with password + DELETE, what is deleted/anonymised/retained, background clean-up, backups and earlier downloads not removed, no invented backup retention period). The Referrals retention paragraph was corrected (the sender's copy and message are removed on account deletion; there is still no per-request deletion). `Terms.jsx` no longer says there is no account-deletion button. The shared "Last updated" date (`LEGAL_UPDATED`) is 2026-11-27.

**Groq stays disabled.** `GROQ_PRIVACY_ACK` must stay `false`/unset and no `GROQ_API_KEY` is configured. The policy text describes the backup as "used only if CareerNest has switched it on". Before enabling it: confirm or enable ZDR in the Groq console if it becomes available to the account, re-read Groq's terms for the free plan, review Groq's sub-processor list, and re-check the policy wording against what you find.

## Groq compatibility audit (offline, 2026-11-27)

**Live status.** One live synthetic connectivity test was run (one request, made-up text only, no user data): HTTP 200, valid JSON in
the expected shape, model `openai/gpt-oss-120b`, 220 tokens (62 of the 90 output tokens were reasoning tokens), no rate-limit error.
Everything else below comes from offline analysis and mocked tests. **The quality of real resume analyses, cover letters, skill gap
analyses and roadmaps produced by Groq has NOT been verified.** The fallback is still disabled (`AI_FALLBACK_PROVIDER=none`,
`GROQ_PRIVACY_ACK=false` in the maintainer's local `.env`).

**Input guard.** `GROQ_MAX_INPUT_CHARS` defaults to **12000** characters (the whole prompt, instructions included). Measured with the real
prompt builders: the instructions alone are about 2.9-3.7K characters for resume analysis, 1.8K for cover letters and 3.0K for skill
gap, so a job-specific analysis with a 4.5K-character resume and a 2K-character job description is about 10.2K characters. With the
earlier value of 8000 most realistic job-specific analyses, cover letters and resume-mode skill gap requests would have skipped the
backup. A skipped backup means the user simply sees the primary provider's error.

**Free-plan budget and truncation.** Groq documents a small per-minute token budget for this model (about 8,000 tokens per minute and
about 1,000 requests per day on the limits table we could read; the exact free-plan values must be checked in the Groq console).
gpt-oss is a reasoning model and its reasoning tokens count as output, so a large request can be refused (HTTP 413 or 429) or
the answer can be cut off. Both end cleanly:
- 429 / 413 are classified as quota / oversize; the caller gets the primary provider's original error.
- A completion with `finish_reason: "length"` is now **never treated as a success**, even if the cut text happens to parse as JSON:
  `groqProvider.js` throws `AI_BAD_RESPONSE` (class `bad_output`, `truncated: true`) and logs only
  `Groq response truncated: finish_reason=length model=<model> completion_tokens=<n>` (no prompt, no response text, no key). The feature
  validators therefore never see truncated output from Groq. Tests: `tests/ai/groqProvider.test.js`, `tests/ai/dualProvider.test.js`.

| Feature | Groq receives | Required JSON | Adapter support | Findings (mocked) | Size risk |
|---|---|---|---|---|---|
| Resume analysis | full resume text (up to 30,000 chars) + job details if chosen | object with required `summary` and `overallScore`, optional lists | yes (`json_object` mode + loose parser) | valid, fenced, extra-field, paraphrased-evidence and numeric-string score all accepted; missing summary or a top-level array rejected as `AI_BAD_RESPONSE`; a 0-10 score is not rescaled | about 1.5-3.5K output tokens: near the per-minute budget for large job-specific requests |
| Cover letter | resume text, job details, account name, tone/length, free-text instructions and facts | `{text, needsInfo}`, text at least 80 chars | yes | valid letter accepted; under 80 chars rejected; an ungrounded claim triggers the existing strict retry, i.e. **two Groq calls for one user request** (still one rate-limiter count) | about 0.5-0.7K output tokens |
| Skill gap | target role, job text, and resume text or manual skills/education/projects/goals | requirements, assessments, summary (the score is computed by CareerNest) | yes | accepted even with an empty summary or missing arrays; the score is identical whichever provider answers | about 0.5-1.5K output tokens |
| Learning roadmap | target role + skill names with priority only (no resume text) | `{tasks:[{id, skill, objective, activity, exercise, completionCriteria}]}` | yes | all 18 tasks kept; partial output (9 of 18) is fine, the rest use the built-in text; over-long text clipped; no `tasks` array, or only unknown ids/skills, rejected | **largest risk**: up to about 8.3K output tokens for 18 tasks at every field limit (about 5K typical) plus reasoning, which can exceed the per-minute budget |

**Rate limiter.** `consumeAiCall` runs once per user request before the AI call (resume analysis and cover letter controllers, skill
gap `analyse`, roadmap generation) and the provider manager never touches it. One Gemini failure followed by one Groq attempt
therefore counts as one rate-limited operation. The only multi-call flow is the cover letter's existing strict retry (up to two
provider calls per request). Worst-case latency with a fallback is about 90 s (Gemini with its one retry) plus 30 s (Groq), inside the
roadmap lock's 3-minute stale window.

**Known behaviour, unchanged by design.** The fallback is triggered by provider failures and by unparseable JSON only. If Gemini returns
parseable JSON that fails a feature validator (for example a missing summary), the user gets `AI_BAD_RESPONSE` and Groq is not tried.
Roadmap task limits, the cover-letter retry, the feature validators, the Gemini primary and the rate limiter were not changed.

## Not yet verified
The real quality of Groq output for resume analysis, cover letters, skill gap analysis and roadmaps (only a synthetic connectivity test has run); real free-plan limits from the Groq console; Groq ZDR status for our account; how Groq's no-training term applies to the free plan; Groq's sub-processor list; Google's current free-tier Gemini terms (the policy only says content "may" be used to improve products, so re-read them periodically).

No live call to Gemini or Groq was made. Real Groq availability of `openai/gpt-oss-120b`, the free-tier limits on your account, `json_object` behaviour with real prompts, real output quality through each caller's validators, and the real error status codes are all unverified until you approve live testing.
