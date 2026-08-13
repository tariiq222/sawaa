import { GetPublicAvailabilityHandler } from '../../../bookings/availability/public/get-public-availability.handler';
import { SemanticSearchHandler } from '../../../ai/semantic-search/semantic-search.handler';
import { GetPublicBrandingHandler } from '../../../org-experience/branding/public/get-public-branding.handler';
import { GetPublicCatalogHandler } from '../../../org-experience/public-catalog/get-public-catalog.handler';
import { ListPublicEmployeesHandler } from '../../../people/employees/public/list-public-employees.handler';
import { AdministrativeToolContext } from './administrative-tool-context';
import { AdministrativeToolsService } from './administrative-tools.service';

describe('AdministrativeToolsService', () => {
  const catalog = { execute: jest.fn() };
  const branding = { execute: jest.fn() };
  const employees = { execute: jest.fn() };
  const availability = { execute: jest.fn() };
  const search = { execute: jest.fn() };
  let service: AdministrativeToolsService;

  beforeEach(() => {
    jest.clearAllMocks();
    catalog.execute.mockResolvedValue({ services: [{ id: 'service-1' }] });
    branding.execute.mockResolvedValue({ organizationNameAr: 'مركز سواء' });
    employees.execute.mockResolvedValue([
      { id: 'employee-1', serviceIds: ['service-1'] },
      { id: 'employee-2', serviceIds: ['service-2'] },
    ]);
    availability.execute.mockResolvedValue([{
      startTime: '2026-08-14T09:00:00.000Z',
      endTime: '2026-08-14T10:00:00.000Z',
    }]);
    search.execute.mockResolvedValue([{ content: 'الدوام من 8 إلى 4', similarity: 0.9 }]);
    service = new AdministrativeToolsService(
      catalog as unknown as GetPublicCatalogHandler,
      branding as unknown as GetPublicBrandingHandler,
      employees as unknown as ListPublicEmployeesHandler,
      availability as unknown as GetPublicAvailabilityHandler,
      search as unknown as SemanticSearchHandler,
    );
  });

  it('publishes a closed administrative allowlist with no clinical, assessment, risk, or emergency capability', () => {
    const definitions = service.getDefinitions();

    expect(definitions.map((definition) => definition.function.name)).toEqual([
      'getCenterInfo',
      'listServices',
      'listPractitioners',
      'getAvailability',
      'searchKnowledge',
      'handoffToReception',
    ]);
    expect(JSON.stringify(definitions)).not.toMatch(
      /diagnos|assessment|triage|clinical|medical|risk|emergency|suicid|تشخيص|تقييم|خطر|طوارئ/i,
    );
  });

  it('rejects every tool name outside the closed allowlist', async () => {
    const result = await service.execute(
      'diagnoseCondition',
      '{}',
      new AdministrativeToolContext('conversation-1', null),
    );

    expect(result).toEqual({ ok: false, error: { code: 'TOOL_NOT_ALLOWED' } });
    expect(catalog.execute).not.toHaveBeenCalled();
    expect(search.execute).not.toHaveBeenCalled();
  });

  it('takes client identity only from context and returns AUTH_REQUIRED for a guest personal-tool attempt', async () => {
    const result = await service.execute(
      'createBooking',
      JSON.stringify({ clientId: 'forged-client', serviceId: 'service-1' }),
      new AdministrativeToolContext('conversation-1', null),
    );

    expect(result).toEqual({ ok: false, error: { code: 'AUTH_REQUIRED' } });
  });

  it('routes general administrative tools through shared handlers', async () => {
    const context = new AdministrativeToolContext('conversation-1', 'client-real');

    await expect(service.execute('getCenterInfo', '{}', context)).resolves.toEqual({
      ok: true,
      data: { organizationNameAr: 'مركز سواء' },
    });
    await expect(service.execute('listServices', '{}', context)).resolves.toEqual({
      ok: true,
      data: [{ id: 'service-1' }],
    });
    await expect(service.execute(
      'listPractitioners',
      JSON.stringify({ serviceId: 'service-1', clientId: 'forged-client' }),
      context,
    )).resolves.toEqual({ ok: true, data: [{ id: 'employee-1', serviceIds: ['service-1'] }] });
    await expect(service.execute(
      'getAvailability',
      JSON.stringify({ employeeId: 'employee-1', date: '2026-08-14', clientId: 'forged-client' }),
      context,
    )).resolves.toEqual({
      ok: true,
      data: [{
        startTime: '2026-08-14T09:00:00.000Z',
        endTime: '2026-08-14T10:00:00.000Z',
      }],
    });
    await expect(service.execute(
      'searchKnowledge',
      JSON.stringify({ query: 'ما أوقات الدوام؟', clientId: 'forged-client' }),
      context,
    )).resolves.toEqual({
      ok: true,
      data: [{ content: 'الدوام من 8 إلى 4', similarity: 0.9 }],
    });

    expect(availability.execute).toHaveBeenCalledWith({
      employeeId: 'employee-1',
      date: '2026-08-14',
    });
    expect(search.execute).toHaveBeenCalledWith({ query: 'ما أوقات الدوام؟', topK: 5 });
  });

  it('returns only a handoff intent and option without assigning staff', async () => {
    await expect(service.execute(
      'handoffToReception',
      '{}',
      new AdministrativeToolContext('conversation-1', null),
    )).resolves.toEqual({
      ok: true,
      data: { intent: 'HANDOFF_TO_RECEPTION', optionOnly: true },
      publicMetadata: { action: 'OFFER_HANDOFF', reason: 'USER_REQUESTED' },
    });
  });

  it('projects and caps catalog results instead of returning raw handler payloads', async () => {
    catalog.execute.mockResolvedValue({
      services: Array.from({ length: 15 }, (_, index) => ({
        id: `service-${index}`,
        categoryId: 'category-1',
        nameAr: `خدمة ${index}`,
        nameEn: `Service ${index}`,
        descriptionAr: 'و'.repeat(800),
        descriptionEn: 'x'.repeat(800),
        durationMins: 60,
        price: 200,
        currency: 'SAR',
        showPrice: true,
        showDuration: true,
        internalSecret: 'must-not-leak',
        durationOptions: [{ raw: 'large-private-shape' }],
      })),
    });

    const result = await service.execute(
      'listServices',
      '{}',
      new AdministrativeToolContext('conversation-1', null),
    );

    expect(result.ok).toBe(true);
    const data = (result as { ok: true; data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(10);
    expect(data[0]).toEqual({
      id: 'service-0',
      categoryId: 'category-1',
      nameAr: 'خدمة 0',
      nameEn: 'Service 0',
      descriptionAr: 'و'.repeat(300),
      descriptionEn: 'x'.repeat(300),
      durationMins: 60,
      price: 200,
      currency: 'SAR',
      showPrice: true,
      showDuration: true,
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(JSON.stringify(result)).not.toContain('large-private-shape');
  });

  it('caps knowledge results and projects only bounded content and similarity', async () => {
    search.execute.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({
      chunkId: `chunk-${index}`,
      documentId: `document-${index}`,
      content: `knowledge-${index}-${'x'.repeat(1_500)}`,
      chunkIndex: index,
      similarity: 0.9,
      rawSecret: 'private',
    })));

    const result = await service.execute(
      'searchKnowledge',
      '{"query":"hours"}',
      new AdministrativeToolContext('conversation-1', null),
    );

    const data = (result as { ok: true; data: Array<Record<string, unknown>> }).data;
    expect(data).toHaveLength(5);
    expect(data[0]).toEqual({ content: `knowledge-0-${'x'.repeat(988)}`, similarity: 0.9 });
    expect(JSON.stringify(result)).not.toContain('chunk-0');
    expect(JSON.stringify(result)).not.toContain('document-0');
    expect(JSON.stringify(result)).not.toContain('private');
  });
});
