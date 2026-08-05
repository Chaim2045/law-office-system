# Vendored dependency — flatpickr

**Package:** flatpickr
**Version:** 4.6.13
**Vendored (self-hosted):** these files are served from `apps/admin-panel/vendor/flatpickr/`
under the app's own origin (CSP `'self'`) — never from a CDN at runtime.

## Files & upstream source

All files are the canonical published 4.6.13 artifacts from cdnjs:

| File | Upstream URL | SHA-256 |
|------|--------------|---------|
| `flatpickr.min.js` | https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.js | `1eeab1cb779471a0b0aaa93dd91c2eb1aa537d696f01ab05ea9dabc55e8525a1` |
| `flatpickr.min.css` | https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css | `1b34a42552c96f10e4dfaaa4a367276b03868aacff63c1ac42ffe331352bc754` |
| `l10n/he.js` | https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/l10n/he.js | `f3fded54dcce447a1a6737d22ec87cdd4ee3f910989ced23a237eaa9959ef966` |

`l10n/he.js` is the **unminified** canonical locale artifact (1669 bytes) that every CDN
publishes for 4.6.13 — not cdnjs's separate `he.min.js`.

## Verifying integrity

```sh
cd apps/admin-panel/vendor/flatpickr
sha256sum flatpickr.min.js flatpickr.min.css l10n/he.js
```

The output must match the SHA-256 column above.

## Security note — these files are invisible to automated dependency scanners

Because flatpickr is vendored (copied into the repo), **Dependabot / npm-audit do NOT see
these files** — flatpickr is not in `package.json`. A flatpickr CVE will therefore NOT be
surfaced automatically and must be tracked manually (watch the flatpickr GitHub releases:
https://github.com/flatpickr/flatpickr/releases).
