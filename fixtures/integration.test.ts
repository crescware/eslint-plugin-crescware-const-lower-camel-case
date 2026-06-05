import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const oxlintBin = resolve(repoRoot, "node_modules/.bin/oxlint");
const fixturesDir = resolve(repoRoot, "fixtures");
const configPath = resolve(fixturesDir, "oxlintrc.fixtures.json");

type Diagnostic = {
  message: string;
  filename: string;
  severity: string;
};

type OxlintReport = { diagnostics: Diagnostic[] };

let allDiagnostics: Diagnostic[] = [];

const runFixturesOnce = (): Diagnostic[] => {
  const result = spawnSync(
    oxlintBin,
    ["-c", configPath, "--no-ignore", "-f", "json", resolve(fixturesDir) + "/"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.error !== undefined && result.error !== null) {
    throw result.error;
  }
  const parsed = JSON.parse(result.stdout ?? "") as OxlintReport;
  return parsed.diagnostics;
};

const messagesFor = (filename: string): string[] => {
  return allDiagnostics
    .filter((v) => v.filename.endsWith(`/${filename}`))
    .map((v) => v.message);
};

const expectedMessage = (name: string): string => {
  return `Const '${name}' must be lowerCamelCase, with an optional single trailing '$' (start lowercase, no underscores, no consecutive uppercase; match /^[a-z][a-zA-Z0-9]*\\$?$/).`;
};

beforeAll(() => {
  const probe = spawnSync(oxlintBin, ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    throw new Error(`oxlint not runnable: ${probe.stderr ?? ""}`);
  }
  allDiagnostics = runFixturesOnce();
});

describe("OK fixtures produce no false positives", () => {
  test.each([
    "ok-simple.ts",
    "ok-single-char.ts",
    "ok-acronym-as-word.ts",
    "ok-digits.ts",
    "ok-object-destructure.ts",
    "ok-array-destructure.ts",
    "ok-let-var.ts",
    "ok-function-params.ts",
    "ok-property-key.ts",
    "ok-for-of.ts",
    "ok-type-parameter.ts",
    "ok-rename-target.ts",
    "ok-trailing-dollar.ts",
  ])("%s", (file) => {
    expect(messagesFor(file)).toEqual([]);
  });
});

// Single source of truth: each NG fixture maps to the binding names it must
// flag, in source order. Both the per-fixture assertions and the grand total
// are derived from this table, so adding a fixture only requires one edit here.
const ngCases: { file: string; note: string; names: string[] }[] = [
  { file: "ng-snake-case.ts", note: "snake_case", names: ["my_var"] },
  { file: "ng-pascal-case.ts", note: "PascalCase", names: ["MyConst"] },
  { file: "ng-upper-snake.ts", note: "UPPER_SNAKE", names: ["MAX_COUNT"] },
  {
    file: "ng-acronym.ts",
    note: "consecutive uppercase rejected",
    names: ["getURL", "userID"],
  },
  {
    file: "ng-leading-underscore.ts",
    note: "leading underscore",
    names: ["_private"],
  },
  {
    file: "ng-trailing-underscore.ts",
    note: "trailing underscore",
    names: ["value_"],
  },
  {
    file: "ng-multiple-declarators.ts",
    note: "two bindings in one declaration",
    names: ["first_one", "second_one"],
  },
  {
    file: "ng-object-destructure.ts",
    note: "shorthand binding",
    names: ["user_id"],
  },
  {
    file: "ng-object-rename.ts",
    note: "key ignored, local binding checked",
    names: ["user_id"],
  },
  {
    file: "ng-array-destructure.ts",
    note: "array destructuring",
    names: ["first_item", "second_item"],
  },
  {
    file: "ng-nested-destructure.ts",
    note: "only the leaf binding",
    names: ["inner_value"],
  },
  {
    file: "ng-default-value.ts",
    note: "count ok, total_sum flagged",
    names: ["total_sum"],
  },
  {
    file: "ng-rest-element.ts",
    note: "firstItem ok, rest_items flagged",
    names: ["rest_items"],
  },
  { file: "ng-for-of.ts", note: "const loop variable", names: ["item_value"] },
  { file: "ng-for-in.ts", note: "const loop variable", names: ["key_name"] },
  {
    file: "ng-leading-dollar.ts",
    note: "leading '$' rejected",
    names: ["$foo"],
  },
  {
    file: "ng-mid-dollar.ts",
    note: "'$' in the middle rejected",
    names: ["foo$bar"],
  },
  {
    file: "ng-consecutive-dollar.ts",
    note: "consecutive '$' rejected",
    names: ["foo$$"],
  },
  {
    file: "ng-underscore-only.ts",
    note: "single underscore rejected",
    names: ["_"],
  },
];

describe("NG fixtures match exactly", () => {
  test.each(ngCases)("$file ($note)", ({ file, names }) => {
    expect(messagesFor(file)).toEqual(names.map(expectedMessage));
  });
});

describe("Totals", () => {
  test("no diagnostics emitted from OK fixtures", () => {
    const okMessages = allDiagnostics
      .filter((v) => /\/ok-/.test(v.filename))
      .map((v) => v.message);
    expect(okMessages).toEqual([]);
  });

  test("every diagnostic is accounted for by an NG fixture case", () => {
    const expectedTotal = ngCases.reduce(
      (sum, ngCase) => sum + ngCase.names.length,
      0,
    );
    expect(allDiagnostics.length).toBe(expectedTotal);
  });
});
