import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Check the emitted Metro graph, not mocked SDK imports in component tests.
const mapPath = process.argv[2];
assert.ok(mapPath, 'Usage: node verify-apple-pay-bundle.mjs <main.jsbundle.map>');
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
function sources(value) {
  return value.sections
    ? value.sections.flatMap((section) => sources(section.map))
    : value.sources ?? [];
}
const buttons = [...new Set(sources(map))].filter((source) =>
  /react-native-moyasar-sdk\/.*react_native_apple_pay\/PKPaymentButton\/index\.js$/.test(source));
assert.equal(buttons.length, 1,
  `Expected one native Apple Pay view module; found ${buttons.length}: ${buttons.join(', ')}`);
console.log(JSON.stringify({ applePayViewModules: buttons.length, source: buttons[0] }));
