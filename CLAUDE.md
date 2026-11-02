# Programming rules

- **Never write comments** - in any code (JS, EJS templates, CSS, scripts), not even one line, not for a dependency on
  another repo, a workaround or a deliberate behavior. Everything must be clear from the code itself: name variables,
  constants and functions so they say it, and split code into well-named functions when a name alone is not enough.
  In extreme cases the name carries even that (e.g. `LINK_PAGE_LIFETIME_SECS_SAME_AS_GAME_REPO`, `getXFromGameRepo()`).
	- When you change code that an existing comment describes, delete that comment instead of updating it.

- Code separation: when a new feature needs code in several places of existing files, put all of it in one module
  named after the feature and leave only short calls at those places - even if the calls must pass a few arguments.
  Whatever a feature puts into existing code is moved out aggressively. Don't merge existing modules into one; only
  keep what a feature adds out of the files it touches.
  Example: linking a key to a Steam account lives in `src/link_key.js` (its routes, signature checks and link pages),
  `src/routes/index.js` keeps one line that mounts it.
  The same goes for tests and test tooling: test-only code goes into its own module or script, required only where it
  is needed - never spread over the files it tests.

# Repo rules

- Don't commit unless I ask to. Every push to master deploys hypersomnia.io at once
  (`.github/workflows/Linux_build.yml`: MMR tests, then ansible `site.yml --tags nginx,homepage`) - push only when
  asked, and site changes for a new game version only after that version is released.

- `npm install` (npm 12, Node 26) follows package-lock.json's better-sqlite3 12.6.2 instead of the 12.10.0 in
  node_modules, skips install scripts and drops the native `better_sqlite3.node` - 12.6.2 does not build on Node 26,
  so the site dies on the first DB open. To add a dependency: `npm install <pkg> --no-save`, then edit package.json
  and the lock by hand; or keep a copy of node_modules/better-sqlite3 first and check
  `new (require('better-sqlite3'))(':memory:')` afterwards.

- Never test on production (official hosts, test keys in the hub's official_servers.d, ranked reports to
  hypersomnia.io, throwaway users) unless I ask for it myself in the current session.
