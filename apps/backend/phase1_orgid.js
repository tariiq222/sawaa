const { Project } = require("ts-morph");
const path = require("path");

const project = new Project({
  tsConfigFilePath: "/Users/tariq/code/sawaa/apps/backend/tsconfig.json",
});

const sourceFiles = project.getSourceFiles().filter(sf => {
  const p = sf.getFilePath();
  return p.includes("/src/") && !p.includes("/node_modules/") && !p.endsWith(".spec.ts") && !p.endsWith(".test.ts");
});

const CONSTANTS_PATH = "/Users/tariq/code/sawaa/apps/backend/src/common/tenant/tenant.constants.ts";

let modifiedFiles = 0;
let replacements = 0;

for (const sf of sourceFiles) {
  const text = sf.getFullText();
  
  // Check if the file uses requireOrganizationIdOrDefault
  if (!text.includes("requireOrganizationIdOrDefault()")) continue;
  
  // Replace the expression
  const newText = text.replace(/this\.tenant\.requireOrganizationIdOrDefault\(\)/g, () => {
    replacements++;
    return "DEFAULT_ORGANIZATION_ID";
  });
  
  if (newText === text) continue;
  
  sf.replaceWithText(newText);
  
  // Check if import already exists after replacement
  const hasImport = sf.getImportDeclarations().some(imp => {
    const moduleSrc = imp.getModuleSpecifierValue();
    if (!moduleSrc.includes("tenant.constants") && !moduleSrc.includes("common/tenant")) return false;
    return imp.getNamedImports().some(n => n.getName() === "DEFAULT_ORGANIZATION_ID");
  });
  
  if (!hasImport) {
    // Calculate relative path from this file to tenant.constants.ts
    const fileDir = path.dirname(sf.getFilePath());
    const constantsFile = CONSTANTS_PATH;
    let relativePath = path.relative(fileDir, constantsFile);
    relativePath = relativePath.replace(/\\/g, "/").replace(/\.ts$/, "");
    if (!relativePath.startsWith(".")) {
      relativePath = "./" + relativePath;
    }
    
    sf.addImportDeclaration({
      namedImports: ["DEFAULT_ORGANIZATION_ID"],
      moduleSpecifier: relativePath,
    });
  }
  
  modifiedFiles++;
}

console.log(`Modified ${modifiedFiles} files, ${replacements} replacements`);
project.saveSync();
