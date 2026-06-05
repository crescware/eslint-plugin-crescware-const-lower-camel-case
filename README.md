# @crescware/eslint-plugin-crescware-const-no-upper-snake-case

ESLint plugin that forbids `const` declaration bindings named in
SCREAMING_SNAKE_CASE. lowerCamelCase is preferred and PascalCase is allowed for
components and classes. It ships as a standard ESLint plugin and is dogfooded on
its own source through [oxlint](https://oxc.rs/docs/guide/usage/linter)'s JS
plugin support.

## Rule: `crescware-const-no-upper-snake-case/const-no-upper-snake-case`

Only SCREAMING_SNAKE_CASE binding names are rejected. A name is rejected when
every character is an uppercase letter, a digit or an underscore and the first
character is an uppercase letter — that is, it contains no lowercase letter at
all:

- Rejected: `NAME_MAX_LENGTH`, `ERROR_KEY`, `ANSWER`, `URL`, and a single
  uppercase letter such as `X`.
- Allowed: lowerCamelCase (`fooBar`, `getUrl`) and PascalCase (`Foo`,
  `BazComponent`, `QuxContext`) for components and classes.
- A leading underscore (`_keys`, `_`) is allowed: the first character is not an
  uppercase letter.
- Any name containing at least one lowercase letter is allowed, because the
  rejection pattern admits no lowercase character.

### What is checked

Every binding introduced by a `const` declaration, including:

- simple bindings (`const fooBar = 1`)
- object / array destructuring (`const { a } = o`, `const [b] = arr`)
- renamed destructuring — the local binding, not the source key
  (`const { id: userId } = o` checks `userId`)
- nested patterns, default values and rest elements
- `for (const … of …)` / `for (const … in …)` loop variables

### What is not checked

`let` / `var`, function parameters, object property keys, type names, type
parameters and import bindings are out of scope.

```ts
const fooBar = 1; // ok (lowerCamelCase)
const Foo = 1; // ok (PascalCase, e.g. a component or class)
const ANSWER = 1; // error: must not be SCREAMING_SNAKE_CASE
const { ERROR_KEY } = resp; // error on `ERROR_KEY`
let LOOSE_NAME = 1; // ok (not a const)
```

## Usage (as a published ESLint plugin)

```sh
pnpm add -D @crescware/eslint-plugin-crescware-const-no-upper-snake-case
```

```js
import constNoUpperSnakeCase from "@crescware/eslint-plugin-crescware-const-no-upper-snake-case";

export default [
  {
    plugins: {
      "crescware-const-no-upper-snake-case": constNoUpperSnakeCase,
    },
    rules: {
      "crescware-const-no-upper-snake-case/const-no-upper-snake-case": "error",
    },
  },
];
```

## Stack

- **Runtime**: Node.js 24 (via [mise](https://mise.jdx.dev/))
- **Package manager**: pnpm (via corepack)
- **Language**: TypeScript ([native preview](https://github.com/nicolo-ribaudo/tc39-proposal-type-annotations))
- **Test**: [Vitest](https://vitest.dev/)
- **Lint**: [oxlint](https://oxc.rs/docs/guide/usage/linter)
- **Format**: [oxfmt](https://github.com/nicolo-ribaudo/oxfmt)
- **Unused code**: [Knip](https://knip.dev/)

## How it is built and verified

- `src/index.ts` is the plugin: a self-contained ESLint rule with no runtime
  dependencies. `pnpm build` compiles it to `dist/` (with `.d.ts`) via
  `tsconfig.build.json`.
- `.oxlintrc.json` loads the plugin through `jsPlugins: ["./src/index.ts"]` and
  enables the rule on this repository's own source, so the plugin lints itself
  (no `const` in `src/` is SCREAMING_SNAKE_CASE).
- `fixtures/*.ts` are lint fixtures: `ng-*.ts` must produce diagnostics and
  `ok-*.ts` must produce none. They are linted with the separate
  `fixtures/oxlintrc.fixtures.json` (all built-in categories off, only this
  rule on) and are excluded from the main lint via `ignorePatterns`.
- `fixtures/integration.test.ts` runs oxlint over the fixtures once and asserts
  the exact per-file diagnostic messages.

## Setup

```sh
mise install
corepack enable
pnpm install
```

## Scripts

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `pnpm build`         | Compile `src/index.ts` to `dist/` with `.d.ts` |
| `pnpm check`         | Run all checks (types, lint, knip, test)       |
| `pnpm check:types`   | Type check                                     |
| `pnpm check:lint`    | Lint (incl. self-dogfooding) and format check  |
| `pnpm check:knip`    | Unused files/exports check                     |
| `pnpm exec:fixtures` | Print raw fixture diagnostics as JSON          |
| `pnpm test`          | Run the fixture integration test               |
| `pnpm format`        | Fix lint and format                            |
