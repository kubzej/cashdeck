# Browser tests

Playwright tests are grouped by the user-facing area they cover:

- `auth/` contains sign-in and signed-out behavior.
- `shell/` contains app-wide navigation and protected-shell behavior.
- `settings/` contains settings-specific behavior.
- `categories/` contains kategorie seznam, formuláře, řazení a destruktivní akce.
- `labels/` contains štítky seznam, vyhledávání, formuláře a destruktivní akce.
- `wallets/` contains peněženky seznam, formuláře, řazení a destruktivní akce.
- `recurring/` contains opakování: vytvoření, úpravy, převody, ukončení a destruktivní akce.
- `transactions/` contains transakce: seznam, filtry a období, vytvoření, úpravy a souhrn výběru.
- `transfers/` contains převody: vytvoření, úpravy, seznam a dopad na peněženky.
- `planned/` contains Naplánované: budoucí položky a chybový stav.
- `overview/` contains Přehled: bohatství, tok peněz, kategorie a štítky.
- `independence/` contains Nezávislost: průběh k cíli, kalkulačky a nastavení.
- `support/` contains shared unlock/API mocks and helpers, without product
  assertions.

Add a new spec beside the workflow it verifies. Keep mocks in `support/` and
avoid combining unrelated workflows into one long scenario.
