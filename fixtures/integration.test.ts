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
  return `Const '${name}' must be lowerCamelCase (match /^[a-z][a-zA-Z0-9]*$/).`;
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
    "ok-consecutive-caps.ts",
    "ok-digits.ts",
    "ok-object-destructure.ts",
    "ok-array-destructure.ts",
    "ok-let-var.ts",
    "ok-function-params.ts",
    "ok-property-key.ts",
    "ok-for-of.ts",
    "ok-type-parameter.ts",
    "ok-rename-target.ts",
  ])("%s", (file) => {
    expect(messagesFor(file)).toEqual([]);
  });
});

describe("NG fixtures match exactly", () => {
  test("ng-snake-case.ts", () => {
    expect(messagesFor("ng-snake-case.ts")).toEqual([
      expectedMessage("my_var"),
    ]);
  });

  test("ng-pascal-case.ts", () => {
    expect(messagesFor("ng-pascal-case.ts")).toEqual([
      expectedMessage("MyConst"),
    ]);
  });

  test("ng-upper-snake.ts", () => {
    expect(messagesFor("ng-upper-snake.ts")).toEqual([
      expectedMessage("MAX_COUNT"),
    ]);
  });

  test("ng-leading-underscore.ts", () => {
    expect(messagesFor("ng-leading-underscore.ts")).toEqual([
      expectedMessage("_private"),
    ]);
  });

  test("ng-trailing-underscore.ts", () => {
    expect(messagesFor("ng-trailing-underscore.ts")).toEqual([
      expectedMessage("value_"),
    ]);
  });

  test("ng-multiple-declarators.ts (two bindings in one declaration)", () => {
    expect(messagesFor("ng-multiple-declarators.ts")).toEqual([
      expectedMessage("first_one"),
      expectedMessage("second_one"),
    ]);
  });

  test("ng-object-destructure.ts (shorthand binding)", () => {
    expect(messagesFor("ng-object-destructure.ts")).toEqual([
      expectedMessage("user_id"),
    ]);
  });

  test("ng-object-rename.ts (key ignored, local binding checked)", () => {
    expect(messagesFor("ng-object-rename.ts")).toEqual([
      expectedMessage("user_id"),
    ]);
  });

  test("ng-array-destructure.ts", () => {
    expect(messagesFor("ng-array-destructure.ts")).toEqual([
      expectedMessage("first_item"),
      expectedMessage("second_item"),
    ]);
  });

  test("ng-nested-destructure.ts (only the leaf binding)", () => {
    expect(messagesFor("ng-nested-destructure.ts")).toEqual([
      expectedMessage("inner_value"),
    ]);
  });

  test("ng-default-value.ts (count ok, total_sum flagged)", () => {
    expect(messagesFor("ng-default-value.ts")).toEqual([
      expectedMessage("total_sum"),
    ]);
  });

  test("ng-rest-element.ts (firstItem ok, rest_items flagged)", () => {
    expect(messagesFor("ng-rest-element.ts")).toEqual([
      expectedMessage("rest_items"),
    ]);
  });

  test("ng-for-of.ts (const loop variable)", () => {
    expect(messagesFor("ng-for-of.ts")).toEqual([
      expectedMessage("item_value"),
    ]);
  });

  test("ng-for-in.ts (const loop variable)", () => {
    expect(messagesFor("ng-for-in.ts")).toEqual([expectedMessage("key_name")]);
  });
});

describe("Totals", () => {
  test("no diagnostics emitted from OK fixtures", () => {
    const okMessages = allDiagnostics
      .filter((v) => /\/ok-/.test(v.filename))
      .map((v) => v.message);
    expect(okMessages).toEqual([]);
  });

  test("exactly 16 diagnostics across all NG fixtures", () => {
    expect(allDiagnostics.length).toBe(16);
  });
});
