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
  return `Const '${name}' must not be SCREAMING_SNAKE_CASE. Use lowerCamelCase (PascalCase is allowed for components/classes).`;
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
    "ok-lower-and-pascal.ts",
    "ok-nested-destructure.ts",
    "ok-let-var.ts",
  ])("%s", (file) => {
    expect(messagesFor(file)).toEqual([]);
  });
});

// Single source of truth: each NG fixture maps to the binding names it must
// flag, in source order. Both the per-fixture assertions and the grand total
// are derived from this table, so adding a fixture only requires one edit here.
const ngCases: { file: string; note: string; names: string[] }[] = [
  {
    file: "ng-screaming.ts",
    note: "SCREAMING_SNAKE_CASE constants",
    names: ["NAME_MAX_LENGTH", "ERROR_KEY", "ANSWER", "URL"],
  },
  {
    file: "ng-single-upper.ts",
    note: "single uppercase letter",
    names: ["X"],
  },
  {
    file: "ng-object-destructure.ts",
    note: "destructured shorthand binding",
    names: ["A_B"],
  },
  {
    file: "ng-array-destructure.ts",
    note: "array binding",
    names: ["FOO"],
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
