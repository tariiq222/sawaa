/**
 * Keep Redocly 1.x working with js-yaml 5.x.
 *
 * openapi-typescript currently loads Redocly 1.x, which expects js-yaml's
 * removed `types` export and `Schema#extend` helper. The root security override
 * intentionally keeps js-yaml on 5.x, so restore only those compatibility
 * aliases before the generator starts.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- NODE_OPTIONS preload is CommonJS. */
const yaml = require("js-yaml");

if (!yaml.types) {
  yaml.types = {
    merge: yaml.mergeTag,
    binary: yaml.binaryTag,
    omap: yaml.omapTag,
    pairs: yaml.pairsTag,
    set: yaml.setTag,
  };
}

if (typeof yaml.JSON_SCHEMA.extend !== "function") {
  yaml.JSON_SCHEMA.extend = ({ implicit = [], explicit = [] } = {}) =>
    new yaml.Schema([...yaml.JSON_SCHEMA.tags, ...implicit, ...explicit]);
}
