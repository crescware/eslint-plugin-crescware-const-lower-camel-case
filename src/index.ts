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

// Forbid SCREAMING_SNAKE_CASE only: a name made entirely of uppercase letters,
// digits and underscores, starting with an uppercase letter (NAME_MAX_LENGTH,
// ANSWER, URL, X). Because the name must contain no lowercase letter at all,
// PascalCase (Foo, FooBar, DropdownIndicator) and lowerCamelCase (fooBar)
// always contain a lowercase letter and pass; a leading "_" (_keys, _) also
// passes since the first char is not uppercase.
const upperSnakePattern = /^[A-Z][A-Z0-9_]*$/;

const isUpperSnakeCase = (name: string): boolean => {
  return upperSnakePattern.test(name);
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
        "Forbid const declaration bindings named in SCREAMING_SNAKE_CASE. lowerCamelCase is preferred and PascalCase is allowed for components/classes.",
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
        if (!isUpperSnakeCase(identifier.name)) {
          continue;
        }
        context.report({
          message: `Const '${identifier.name}' must not be SCREAMING_SNAKE_CASE. Use lowerCamelCase (PascalCase is allowed for components/classes).`,
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
  meta: { name: "crescware-const-no-upper-snake-case" },
  rules: {
    "const-no-upper-snake-case": rule,
  },
};

export default plugin;
