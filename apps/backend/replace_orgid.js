const { Project, SyntaxKind } = require("ts-morph");

const project = new Project({
  tsConfigFilePath: "/Users/tariq/code/sawaa/apps/backend/tsconfig.json",
});

const sourceFiles = project.getSourceFiles().filter(sf => {
  const path = sf.getFilePath();
  return path.includes("/src/") && !path.includes("/node_modules/") && !path.endsWith(".spec.ts") && !path.endsWith(".test.ts");
});

let modifiedFiles = 0;
let replacements = 0;

for (const sf of sourceFiles) {
  let modified = false;
  const text = sf.getFullText();
  
  // Simple text replacement for the exact expression
  const newText = text.replace(/this\.tenant\.requireOrganizationIdOrDefault\(\)/g, () => {
    replacements++;
    return "DEFAULT_ORGANIZATION_ID";
  });
  
  if (newText !== text) {
    sf.replaceWithText(newText);
    modified = true;
  }
  
  if (modified) {
    modifiedFiles++;
  }
}

console.log(`Modified ${modifiedFiles} files, ${replacements} replacements`);
project.saveSync();
