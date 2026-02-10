# Koda Project Audit & Improvement Recommendations

Date: 2026-02-10  
Scope: repository-wide static audit focused on browser automation reliability, security posture, packaging, and operational readiness.

## Executive Summary

Koda has a strong feature surface (multi-provider LLM abstraction, browser adapters, selector healing, API/WS interfaces, and enterprise modules), but there are several high-impact engineering risks that can affect consumers in production.

**Top priorities:**
1. Fix npm packaging/entrypoint integrity (currently likely broken for published consumers).
2. Tighten API/tool security boundaries (rate limiting, SSRF/file scope hardening, auth defaults).
3. Improve test/lint signal quality in CI and release gates.
4. Reduce operational risk with structured logging, observability standards, and runtime safeguards.

---

## What’s Working Well

- Clear modular organization under `src/` by domain (`api`, `browser`, `tools`, `learning`, `enterprise`, etc.).
- Good use of event-driven patterns (`EventEmitter`) for extensibility and telemetry hooks.
- Built-in resilience concepts (self-healing selectors, retry logic in API tool, WS heartbeat checks).
- Existing unit/integration test scaffolding and documentation footprint.

---


## Implementation Status (Current)

The following recommendations from this report have now been implemented in the repository:

- ✅ Packaging/runtime inclusion fix via npm `files` update to include root-level runtime modules.
- ✅ REST API rate limiting middleware added and wired to `rateLimit` configuration.
- ✅ `APITool` outbound URL guardrails for protocol/private-network/allowlist controls.
- ✅ `FileTool` path-boundary hardening with `path.relative` checks and symlink rejection.
- ✅ CI/release script hardening by removing failure-swallowing from `test`, `lint`, and `build` scripts.
- ✅ CLI short-flag conflict resolved (`-H` for `--headless` in standalone command).

## Key Findings and Recommendations

## 1) **Critical: npm package can publish an unusable entrypoint**

### Evidence
- `src/index.js` imports `../taskOrchestrator`, which is outside `src/`.
- `package.json` `files` only includes `src/`, `bin/`, `README.md`, `LICENSE`.
- `npm pack --dry-run` confirms `taskOrchestrator.js` is excluded from tarball.

### Impact
Consumers installing from npm may get runtime `MODULE_NOT_FOUND` when loading the library.

### Recommendation
- Move `taskOrchestrator.js` and required root-level runtime modules into `src/` (or include them in `files`).
- Add a packaging smoke test in CI:
  - `npm pack --dry-run`
  - install tarball in a temp dir
  - `node -e "require('@trentpierce/koda')"`
- Fail CI on missing runtime files.

Priority: **P0**

---

## 2) **Security: configured REST rate limit is never applied**

### Evidence
`RestAPIServer` exposes `rateLimit` config but no middleware applies it.

### Impact
Unauthenticated/public deployments can be trivially flooded (resource exhaustion, cost increase, noisy neighbor behavior).

### Recommendation
- Add `express-rate-limit` middleware and wire to `this.options.rateLimit`.
- Add per-route stricter limits for session creation/action endpoints.
- Emit rate-limit metrics/events for monitoring.

Priority: **P0/P1**

---

## 3) **Security: tooling layer allows broad network/filesystem access by default**

### Evidence
- `APITool` accepts arbitrary URL with retries but no host allowlist/blocklist.
- `FileTool` defaults `baseDir` to `process.cwd()` and uses a simple `startsWith` guard.
- ToolRegistry executes tools directly from model-driven parameters.

### Impact
Potential SSRF, metadata endpoint access, and file boundary bypass risk in multi-tenant or exposed-agent contexts.

### Recommendation
- Add explicit policy enforcement:
  - URL allowlist/deny private CIDRs for `APITool`.
  - Resolve/normalize `baseDir` and use robust path boundary checks (`path.relative` guard, symlink protections).
  - Tool-level permission model (`allowNetwork`, `allowFileWrite`, `allowedPaths`).
- Add audit logs for tool invocation with redaction.

Priority: **P0/P1**

---

## 4) **Reliability: test/lint scripts currently hide failures**

### Evidence
- `test` script: `jest --coverage --passWithNoTests || exit 0`
- `lint` script: `eslint ... || exit 0`
- `build` script also swallows failure.

### Impact
Broken tests/lint can pass CI/release pipelines silently, increasing defect escape rate.

### Recommendation
- Remove `|| exit 0` from quality gates.
- Keep permissive scripts only as opt-in (`test:soft`, `lint:soft`) if needed locally.
- Enforce strict checks in `prepublishOnly` and CI pipeline branch protections.

Priority: **P1**

---

## 5) **Operational maturity: inconsistent logging strategy**

### Evidence
Multiple production modules use direct `console.log` for runtime status and errors.

### Impact
Difficult log aggregation, inconsistent formats, no correlation IDs, and possible sensitive data leakage.

### Recommendation
- Introduce a centralized logger abstraction (JSON logs, level control, redaction hooks).
- Attach request/session IDs across REST/WS/tool execution paths.
- Replace ad-hoc `console.*` in core runtime with structured logger.

Priority: **P1/P2**

---

## 6) **API hardening: defaults and session lifecycle controls can be stronger**

### Evidence
- REST server binds to `0.0.0.0` by default.
- Session creation takes provider + API key directly in request payload.
- No built-in idle session TTL enforcement observed at REST layer.

### Impact
Higher accidental exposure risk, larger attack surface, and potential resource leakage from stale sessions.

### Recommendation
- Default to localhost bind in development and explicit external bind in production.
- Prefer provider credentials via server-side secret management over raw request payloads.
- Add idle timeout + max session lifetime + max concurrent sessions per token/IP.

Priority: **P1**

---

## 7) **CLI UX/compatibility issues**

### Evidence
Standalone command uses `-h` for `--headless`, conflicting with conventional help short flag.

### Impact
Unexpected CLI behavior and discoverability problems.

### Recommendation
- Use `-H` or remove short flag for headless.
- Add CLI smoke tests for command parsing.

Priority: **P2**

---

## 8) **Release confidence: add browser-automation focused E2E checks**

### Evidence
Current tests are present but environment/dependency variability can prevent meaningful execution in clean environments.

### Impact
Regression risk in critical user journeys (navigation/action/extract/session lifecycle).

### Recommendation
- Add lightweight mocked E2E contract tests for REST + WS flows.
- Add one hermetic browser smoke test (headless Chromium in CI image).
- Track flake rate and mean test duration; quarantine unstable tests with owner + SLA.

Priority: **P2**

---

## Suggested 30/60/90-Day Plan

### 0–30 days (Stabilize)
- Fix package entrypoint/runtime inclusion.
- Wire real rate limiting.
- Remove failure-swallowing from CI-required scripts.
- Add packaging smoke test.

### 31–60 days (Harden)
- Implement tool policy guardrails (network/filesystem).
- Introduce structured logger + correlation IDs.
- Add session TTL/concurrency controls.

### 61–90 days (Scale)
- Expand E2E automation matrix.
- Add SLO dashboards for API/WS and action success latency.
- Define a security review checklist for new tools/providers.

---

## Recommended Metrics (to track improvements)

- Package install/load success in CI (%).
- Action success rate and p95 action latency.
- Session leak rate (sessions > TTL).
- Tool policy violations blocked (%).
- Test pass rate + flake rate over 14 days.
- Mean time to detect failing release gate.

