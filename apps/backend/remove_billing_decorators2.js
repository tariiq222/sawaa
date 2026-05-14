const fs = require('fs');

const files = [
  '/Users/tariq/code/sawaa/apps/backend/src/api/public/bookings.controller.ts',
  '/Users/tariq/code/sawaa/apps/backend/src/api/mobile/client/chat.controller.ts',
  '/Users/tariq/code/sawaa/apps/backend/src/api/mobile/client/bookings.controller.ts',
];

const IMPORT_PATTERNS = [
  /import\s*\{\s*RequireFeature\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/modules\/platform\/billing\/feature\.decorator['"];?\s*\n/g,
  /import\s*\{\s*TrackUsage\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/modules\/platform\/billing\/track-usage\.decorator['"];?\s*\n/g,
  /import\s*\{\s*EnforceLimit\s*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/modules\/platform\/billing\/plan-limits\.decorator['"];?\s*\n/g,
  /import\s*\{\s*RequireFeature\s*\}\s*from\s*['"]\.\.\/\.\.\/modules\/platform\/billing\/feature\.decorator['"];?\s*\n/g,
  /import\s*\{\s*TrackUsage\s*\}\s*from\s*['"]\.\.\/\.\.\/modules\/platform\/billing\/track-usage\.decorator['"];?\s*\n/g,
  /import\s*\{\s*EnforceLimit\s*\}\s*from\s*['"]\.\.\/\.\.\/modules\/platform\/billing\/plan-limits\.decorator['"];?\s*\n/g,
];

const DECORATOR_PATTERNS = [
  /\s*@RequireFeature\([^)]*\)\s*\n/g,
  /\s*@TrackUsage\([^)]*\)\s*\n/g,
  /\s*@EnforceLimit\([^)]*\)\s*\n/g,
];

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  for (const pattern of IMPORT_PATTERNS) {
    content = content.replace(pattern, '');
  }
  
  for (const pattern of DECORATOR_PATTERNS) {
    content = content.replace(pattern, '\n');
  }
  
  fs.writeFileSync(filePath, content);
}

console.log(`Processed ${files.length} files`);
