import { UpsertContactHandler } from './upsert-contact.handler';
import type { PrismaService } from '../../../../infrastructure/database';
import type { ZohoApiClient, ZohoIntegrationConfig } from '../../../../infrastructure/zoho';

/**
 * UpsertContactHandler isolates two tenants by:
 *   1. Looking up ZohoContactLink with the (organizationId, deqahPersonId)
 *      compound key — never just by deqahPersonId.
 *   2. Creating the new ZohoContactLink with the SAME organizationId — the
 *      caller's tenant id is propagated, never inferred.
 *   3. Reading the Client row scoped to the same organizationId.
 */
describe('UpsertContactHandler — tenant isolation', () => {
  const TENANT_A = 'org-A';
  const TENANT_B = 'org-B';
  const CLIENT_ID = 'client-1';
  const ZOHO_CONTACT_ID = 'zc_55';

  const config: ZohoIntegrationConfig = {
    refreshToken: 'rt',
    zohoOrganizationId: 'zoho-A',
    dataCenter: 'sa',
    webhookSecret: 'w',
    defaults: { sendOnCreate: true },
  };

  function makeHandler() {
    const findUnique = jest.fn();
    const create = jest.fn();
    const findFirstOrThrow = jest.fn();
    const prisma = {
      zohoContactLink: { findUnique, create },
      client: { findFirstOrThrow },
    } as unknown as PrismaService;

    const createContact = jest.fn().mockResolvedValue({
      contact: { contact_id: ZOHO_CONTACT_ID, contact_name: 'X' },
    });
    const api = { createContact } as unknown as ZohoApiClient;

    return {
      handler: new UpsertContactHandler(prisma, api),
      findUnique,
      create,
      findFirstOrThrow,
      createContact,
    };
  }

  it('returns the cached zoho contact id without calling Zoho when a link already exists', async () => {
    const { handler, findUnique, createContact, create } = makeHandler();
    findUnique.mockResolvedValue({ zohoContactId: 'cached-zc' });

    const result = await handler.execute({
      organizationId: TENANT_A,
      clientId: CLIENT_ID,
      config,
    });

    expect(result.zohoContactId).toBe('cached-zc');
    expect(createContact).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('looks up the existing link with the (organizationId, deqahPersonId) compound key', async () => {
    const { handler, findUnique, findFirstOrThrow, createContact, create } = makeHandler();
    findUnique.mockResolvedValue(null);
    findFirstOrThrow.mockResolvedValue({
      id: CLIENT_ID,
      name: 'Ali',
      firstName: 'Ali',
      lastName: 'Q',
      email: 'ali@example.com',
      phone: '+966...',
    });

    await handler.execute({ organizationId: TENANT_A, clientId: CLIENT_ID, config });

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_deqahPersonId: {
          organizationId: TENANT_A,
          deqahPersonId: CLIENT_ID,
        },
      },
    });
    // Confirm the Client lookup is also scoped to TENANT_A explicitly.
    expect(findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: CLIENT_ID, organizationId: TENANT_A },
      select: expect.any(Object),
    });
    expect(createContact).toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: TENANT_A,
        deqahPersonId: CLIENT_ID,
        zohoContactId: ZOHO_CONTACT_ID,
      }),
    });
  });

  it('does NOT bleed Tenant A inputs into Tenant B writes', async () => {
    const { handler, findUnique, findFirstOrThrow, create } = makeHandler();
    findUnique.mockResolvedValue(null);
    findFirstOrThrow.mockResolvedValue({
      id: CLIENT_ID,
      name: 'B-name',
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
    });

    await handler.execute({ organizationId: TENANT_B, clientId: CLIENT_ID, config });

    const createArgs = create.mock.calls[0]![0];
    expect(createArgs.data.organizationId).toBe(TENANT_B);
    expect(JSON.stringify(createArgs.data)).not.toContain(TENANT_A);
  });
});
