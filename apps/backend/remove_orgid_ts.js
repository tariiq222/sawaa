const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({
  tsConfigFilePath: "/Users/tariq/code/sawaa/apps/backend/tsconfig.json",
});

const sourceFiles = project.getSourceFiles().filter(sf => {
  const path = sf.getFilePath();
  return path.includes("/src/") && !path.includes("/node_modules/") && !path.endsWith(".spec.ts") && !path.endsWith(".test.ts");
});

const TENANT_EXPRS = [
  "this.tenant.requireOrganizationIdOrDefault()",
  "DEFAULT_ORGANIZATION_ID",
  "session.organizationId ?? this.tenant.requireOrganizationIdOrDefault()",
  "session.organizationId",
  "payload.organizationId",
  "client.organizationId",
  "orgId",
  "org_id",
  "organizationId",
];

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function isTenantExpr(node) {
  const text = normalizeText(node.getText());
  return TENANT_EXPRS.some(expr => text === expr || text === expr + "!");
}

let modifiedFiles = 0;
let removedProps = 0;
let removedVars = 0;

for (const sf of sourceFiles) {
  const rangesToRemove = [];
  
  // Pass 1: Inline organizationId properties in object literals
  for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (prop.getName() !== "organizationId") continue;
    const init = prop.getInitializer();
    if (!init) continue;
    if (isTenantExpr(init)) {
      const parent = prop.getParent();
      if (parent && parent.getKind() === SyntaxKind.ObjectLiteralExpression) {
        rangesToRemove.push({
          start: prop.getStart(),
          end: prop.getEnd(),
        });
        removedProps++;
      }
    }
  }
  
  // Pass 2: Shorthand organizationId properties in object literals
  for (const prop of sf.getDescendantsOfKind(SyntaxKind.ShorthandPropertyAssignment)) {
    if (prop.getName() !== "organizationId") continue;
    const parent = prop.getParent();
    if (parent && parent.getKind() === SyntaxKind.ObjectLiteralExpression) {
      rangesToRemove.push({
        start: prop.getStart(),
        end: prop.getEnd(),
      });
      removedProps++;
    }
  }
  
  // Pass 3: Variable declarations
  for (const decl of sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const name = decl.getName();
    if (name !== "organizationId" && name !== "orgId" && name !== "org_id") continue;
    const init = decl.getInitializer();
    if (!init) continue;
    const initText = normalizeText(init.getText());
    if (isTenantExpr(init) || initText.includes("requireOrganizationIdOrDefault")) {
      const varDeclList = decl.getParent();
      if (varDeclList.getKind() === SyntaxKind.VariableDeclarationList) {
        const siblings = varDeclList.getDeclarations();
        if (siblings.length === 1) {
          const statement = varDeclList.getParent();
          if (statement && statement.getKind() === SyntaxKind.VariableStatement) {
            rangesToRemove.push({
              start: statement.getStart(),
              end: statement.getEnd(),
            });
            removedVars++;
          }
        } else {
          rangesToRemove.push({
            start: decl.getStart(),
            end: decl.getEnd(),
          });
          removedVars++;
        }
      }
    }
  }
  
  if (rangesToRemove.length === 0) continue;
  
  // Sort ranges in reverse order (end to start) so removing earlier doesn't affect later positions
  rangesToRemove.sort((a, b) => b.start - a.start);
  
  let text = sf.getFullText();
  for (const range of rangesToRemove) {
    text = text.slice(0, range.start) + text.slice(range.end);
  }
  
  // Clean up: remove double commas and trailing commas in object literals
  // Be careful not to break syntax
  text = text.replace(/,\s*,/g, ',');
  text = text.replace(/\{\s*,/g, '{');
  text = text.replace(/,\s*\}/g, '}');
  
  sf.replaceWithText(text);
  modifiedFiles++;
}

console.log(`Modified ${modifiedFiles} files, removed ${removedProps} properties, ${removedVars} variables`);
project.saveSync();
