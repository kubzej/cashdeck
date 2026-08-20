# Browser tests

Playwright tests are grouped by the user-facing area they cover:

- `auth/` contains sign-in and signed-out behavior.
- `shell/` contains app-wide navigation and protected-shell behavior.
- `settings/` contains settings-specific behavior.
- `support/` contains shared Neon Auth/API mocks and helpers, without product
  assertions.

Add a new spec beside the workflow it verifies. Keep mocks in `support/` and
avoid combining unrelated workflows into one long scenario.
