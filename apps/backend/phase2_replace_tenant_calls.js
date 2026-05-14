const { Project } = require("ts-morph");

const project = new Project({
  tsConfigFilePath: "/Users/tariq/code/sawaa/apps/backend/tsconfig.json",
});

const sourceFiles = project.getSourceFiles().filter(sf => {
  const p = sf.getFilePath();
  return p.includes("/src/") && !p.includes("/node_modules/") && !p.endsWith(".spec.ts") && !p.endsWith(".test.ts");
});

const CONSTANTS_PATH = "/Users/tariq/code/sawaa/apps/backend/src/common/tenant/tenant.constants.ts";
const path = require("path");

let modifiedFiles = 0;
let replacements = 0;

// Patterns to replace with DEFAULT_ORGANIZATION_ID
const patterns = [
  /this\.tenant\.requireOrganizationId\(\)/g,
  /this\.tenantCtx\.requireOrganizationId\(\)/g,
  /this\.tenant\.getOrganizationId\(\)/g,
  /this\.tenantCtx\.getOrganizationId\(\)/g,
  /this\.ctx\.getOrganizationId\(\)/g,
];

for (const sf of sourceFiles) {
  const text = sf.getFullText();
  let newText = text;
  let fileReplaced = false;
  
  for (const pattern of patterns) {
    newText = newText.replace(pattern, () => {
      replacements++;
      fileReplaced = true;
      return "DEFAULT_ORGANIZATION_ID";
    });
  }
  
  // Also replace: this.tenant.currentPlanLimits() → Promise.resolve(null)
  const planLimitsPattern = /this\.tenant\.currentPlanLimits\(\)/g;
  if (planLimitsPattern.test(newText)) {
    newText = newText.replace(planLimitsPattern, "Promise.resolve(null)");
    replacements++;
    fileReplaced = true;
  }
  
  if (!fileReplaced) continue;
  
  sf.replaceWithText(newText);
  
  // Add import if needed
  const hasImport = sf.getImportDeclarations().some(imp => {
    const moduleSrc = imp.getModuleSpecifierValue();
    if (!moduleSrc.includes("tenant.constants") && !moduleSrc.includes("common/tenant")) return false;
    return imp.getNamedImports().some(n => n.getName() === "DEFAULT_ORGANIZATION_ID");
  });
  
  if (!hasImport) {
    const fileDir = path.dirname(sf.getFilePath());
    let relativePath = path.relative(fileDir, CONSTANTS_PATH);
    relativePath = relativePath.replace(/\\/g, "/").replace(/\.ts$/, "");
    if (!relativePath.startsWith(".")) relativePath = "./" + relativePath;
    
    sf.addImportDeclaration({
      namedImports: ["DEFAULT_ORGANIZATION_ID"],
      moduleSpecifier: relativePath,
    });
  }
  
  modifiedFiles++;
}

console.log(`Modified ${modifiedFiles} files, ${replacements} replacements`);
project.saveSync();
