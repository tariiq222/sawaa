import { UnlinkWhatsappHandler } from "./unlink-whatsapp.handler";

describe("UnlinkWhatsappHandler", () => {
  it("logs out via Evolution and preserves credentials on a successful unlink", async () => {
    const logout = jest.fn().mockResolvedValue({ ok: true });
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      whatsappAgentConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: "cfg-1" }),
        update,
      },
    };
    const transport = {
      resolve: jest.fn().mockResolvedValue({ client: { logout } }),
    };

    const result = await new UnlinkWhatsappHandler(
      prisma as never,
      transport as never,
    ).execute();

    expect(result).toEqual({ unlinked: true, logoutOk: true });
    expect(logout).toHaveBeenCalledTimes(1);
    const updateCall = update.mock.calls[0]?.[0];
    expect(updateCall).toEqual({
      where: { id: "cfg-1" },
      data: expect.objectContaining({
        isActive: false,
        isConnected: false,
        connectedPhone: null,
      }),
    });
    expect(updateCall.data).not.toHaveProperty("evolutionBaseUrl");
    expect(updateCall.data).not.toHaveProperty("evolutionInstanceName");
    expect(updateCall.data).not.toHaveProperty("credentialsCiphertext");
    expect(updateCall.data).not.toHaveProperty("webhookSecretEnc");
  });

  it("still pauses the agent when Evolution logout fails", async () => {
    const logout = jest.fn().mockRejectedValue(new Error("network"));
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      whatsappAgentConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: "cfg-1" }),
        update,
      },
    };
    const transport = {
      resolve: jest.fn().mockResolvedValue({ client: { logout } }),
    };

    const result = await new UnlinkWhatsappHandler(
      prisma as never,
      transport as never,
    ).execute();

    expect(result).toEqual({ unlinked: true, logoutOk: false });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("succeeds without an agent config row", async () => {
    const logout = jest.fn().mockResolvedValue({ ok: true });
    const prisma = {
      whatsappAgentConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const transport = {
      resolve: jest.fn().mockResolvedValue({ client: { logout } }),
    };

    const result = await new UnlinkWhatsappHandler(
      prisma as never,
      transport as never,
    ).execute();

    expect(result).toEqual({ unlinked: true, logoutOk: true });
    expect(prisma.whatsappAgentConfig.update).not.toHaveBeenCalled();
  });
});
