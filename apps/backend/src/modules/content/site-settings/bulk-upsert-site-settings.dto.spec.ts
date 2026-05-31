import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  BulkUpsertSiteSettingsDto,
  SiteSettingEntryDto,
} from './bulk-upsert-site-settings.dto';

describe('SiteSettingEntryDto', () => {
  it('should be defined', () => {
    const dto = new SiteSettingEntryDto();
    expect(dto).toBeDefined();
  });

  it('rejects text values longer than 10000 chars', async () => {
    const dto = plainToInstance(SiteSettingEntryDto, {
      key: 'home.hero.title.ar',
      valueAr: 'a'.repeat(10_001),
    });
    const errors = await validate(dto);
    const valueArError = errors.find((e) => e.property === 'valueAr');
    expect(valueArError).toBeDefined();
    expect(valueArError?.constraints).toHaveProperty('maxLength');
  });

  it('accepts text values at the 10000-char boundary', async () => {
    const dto = plainToInstance(SiteSettingEntryDto, {
      key: 'home.hero.title.ar',
      valueAr: 'a'.repeat(10_000),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('BulkUpsertSiteSettingsDto', () => {
  const entry = (key = 'home.hero.title.ar') => ({ key, valueAr: 'x' });

  it('rejects an entries array larger than 100', async () => {
    const dto = plainToInstance(BulkUpsertSiteSettingsDto, {
      entries: Array.from({ length: 101 }, (_, i) => entry(`home.k${i}`)),
    });
    const errors = await validate(dto);
    const entriesError = errors.find((e) => e.property === 'entries');
    expect(entriesError).toBeDefined();
    expect(entriesError?.constraints).toHaveProperty('arrayMaxSize');
  });

  it('accepts an entries array of exactly 100', async () => {
    const dto = plainToInstance(BulkUpsertSiteSettingsDto, {
      entries: Array.from({ length: 100 }, (_, i) => entry(`home.k${i}`)),
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty entries array', async () => {
    const dto = plainToInstance(BulkUpsertSiteSettingsDto, { entries: [] });
    const errors = await validate(dto);
    const entriesError = errors.find((e) => e.property === 'entries');
    expect(entriesError).toBeDefined();
    expect(entriesError?.constraints).toHaveProperty('arrayMinSize');
  });
});
