type Identifier = { type: "Identifier"; name: string };

type Pattern = {
  type: string;
  name?: string;
  elements?: (Pattern | null)[];
  properties?: ObjectPatternProperty[];
  argument?: Pattern;
  left?: Pattern;
  value?: Pattern;
};

type ObjectPatternProperty =
  | { type: "Property"; value: Pattern }
  | { type: "RestElement"; argument: Pattern };

type VariableDeclarator = { type: "VariableDeclarator"; id: Pattern };

type VariableDeclaration = {
  type: "VariableDeclaration";
  kind: "const" | "let" | "var";
  declarations: VariableDeclarator[];
};

type ReportDescriptor = { message: string; node: unknown };
type RuleContext = { report: (descriptor: ReportDescriptor) => void };

type Visitor = Record<string, (node: never) => void>;

type Rule = {
  meta?: Record<string, unknown>;
  create: (context: RuleContext) => Visitor;
};

// lowerCamelCase: starts with a lowercase letter, then letters/digits only,
// with an optional single trailing "$", and has no two consecutive uppercase
// letters. Acronyms are treated as words (getUrl / userId are required, not
// getURL / userID). A single char (x) is allowed; a trailing "$" (form$) is
// allowed for valibot-style schema variables. Underscores, a leading "$", a
// "$" in the middle (foo$bar), consecutive "$" (foo$$), PascalCase (MyConst)
// and UPPER_CASE (ANSWER) are rejected.
const lowerCamelPattern = /^[a-z][a-zA-Z0-9]*\$?$/;
const consecutiveUpperPattern = /[A-Z]{2}/;

const isLowerCamelCase = (name: string): boolean => {
  return lowerCamelPattern.test(name) && !consecutiveUpperPattern.test(name);
};

const collectPatternIdentifiers = (node: Pattern | null): Identifier[] => {
  if (node === null) {
    return [];
  }
  switch (node.type) {
    case "Identifier":
      if (typeof node.name !== "string") {
        return [];
      }
      return [node as Identifier];
    case "ArrayPattern":
      return (node.elements ?? []).flatMap((element) =>
        collectPatternIdentifiers(element),
      );
    case "ObjectPattern":
      return (node.properties ?? []).flatMap((property) => {
        if (property.type === "Property") {
          return collectPatternIdentifiers(property.value);
        }
        if (property.type === "RestElement") {
          return collectPatternIdentifiers(property.argument);
        }
        return [];
      });
    case "RestElement":
      return collectPatternIdentifiers(node.argument ?? null);
    case "AssignmentPattern":
      return collectPatternIdentifiers(node.left ?? null);
    default:
      return [];
  }
};

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require every const declaration binding to be named in lowerCamelCase, optionally with a single trailing '$' (matching /^[a-z][a-zA-Z0-9]*\\$?$/).",
    },
    schema: [],
  },
  create(context) {
    const checkDeclaration = (node: VariableDeclaration): void => {
      if (node.kind !== "const") {
        return;
      }
      const identifiers = node.declarations.flatMap((declarator) =>
        collectPatternIdentifiers(declarator.id),
      );
      for (const identifier of identifiers) {
        if (isLowerCamelCase(identifier.name)) {
          continue;
        }
        context.report({
          message: `Const '${identifier.name}' must be lowerCamelCase, with an optional single trailing '$' (start lowercase, no underscores, no consecutive uppercase; match /^[a-z][a-zA-Z0-9]*\\$?$/).`,
          node: identifier,
        });
      }
    };

    return {
      VariableDeclaration: checkDeclaration as unknown as (node: never) => void,
    };
  },
};

const plugin = {
  meta: { name: "crescware-const-lower-camel-case" },
  rules: {
    "const-lower-camel-case": rule,
  },
};

export default plugin;
