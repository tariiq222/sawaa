const fs = require('fs');
const path = require('path');

const targetDir = path.resolve('/Users/tariq/code/sawaa/apps/backend/src/api/dashboard');

// Patterns to remove
const IMPORT_PATTERNS = [
  /import\s*\{\s*RequireFeature\s*\}\s*from\s*['"]\.\.\/\.\.\/modules\/platform\/billing\/feature\.decorator['"];?\s*\n/g,
  /import\s*\{\s*TrackUsage\s*\}\s*from\s*['"]\.\.\/\.\.\/modules\/platform\/billing\/track-usage\.decorator['"];?\s*\n/g,
  /import\s*\{\s*EnforceLimit\s*\}\s*from\s*['"]\.\.\/\.\.\/modules\/platform\/billing\/plan-limits\.decorator['"];?\s*\n/g,
];

const DECORATOR_PATTERNS = [
  /\s*@RequireFeature\([^)]*\)\s*\n/g,
  /\s*@TrackUsage\([^)]*\)\s*\n/g,
  /\s*@EnforceLimit\([^)]*\)\s*\n/g,
];

const files = fs.readdirSync(targetDir)
  .filter(f => f.endsWith('.controller.ts'))
  .map(f => path.join(targetDir, f));

let modifiedFiles = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  for (const pattern of IMPORT_PATTERNS) {
    content = content.replace(pattern, '');
  }
  
  for (const pattern of DECORATOR_PATTERNS) {
    content = content.replace(pattern, '\n');
  }
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    modifiedFiles++;
  }
}

console.log(`Modified ${modifiedFiles} files`);
