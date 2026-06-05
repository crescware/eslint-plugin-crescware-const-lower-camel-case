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

// lowerCamelCase: first char lowercase, then letters/digits only. Allows
// consecutive capitals (getURL) and a single char (x); forbids underscores,
// a leading "$", PascalCase (MyConst) and UPPER_CASE (ANSWER).
const lowerCamelPattern = /^[a-z][a-zA-Z0-9]*$/;

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
        "Require every const declaration binding to be named in lowerCamelCase.",
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
        if (lowerCamelPattern.test(identifier.name)) {
          continue;
        }
        context.report({
          message: `Const '${identifier.name}' must be lowerCamelCase (match /^[a-z][a-zA-Z0-9]*$/).`,
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
