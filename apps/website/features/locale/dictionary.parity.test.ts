import { describe, expect, it } from 'vitest';
import { dictionary, dictionaryFeatures } from './dictionary';

describe('dictionary key parity', () => {
  it('exposes every feature group through the aggregator', () => {
    const groupKeys = dictionaryFeatures.flatMap((feature) => Object.keys(feature.ar));
    // Sorted copies: the aggregator merges groups, and some original key
    // order was interleaved across features, so only the key sets are stable.
    const sortedGroupKeys = [...groupKeys].sort();
    expect(Object.keys(dictionary.ar).sort()).toEqual(sortedGroupKeys);
    expect(Object.keys(dictionary.en).sort()).toEqual(sortedGroupKeys);
  });

  it.each(dictionaryFeatures.map((feature) => [feature.name, feature] as const))(
    'matches Arabic and English keys in the %s group',
    (_name, feature) => {
      expect(Object.keys(feature.en).sort()).toEqual(Object.keys(feature.ar).sort());
    },
  );

  it('matches sorted Arabic and English keys across the whole dictionary', () => {
    expect(Object.keys(dictionary.en).sort()).toEqual(Object.keys(dictionary.ar).sort());
  });
});
