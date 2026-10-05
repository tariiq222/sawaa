import { Prisma } from "@prisma/client";
import { GetLateSessionContextHandler } from "./get-late-session-context.handler";

describe("GetLateSessionContextHandler", () => {
  const handlerFor = (settings: unknown) =>
    new GetLateSessionContextHandler({
      withTransaction: (cb: any) =>
        cb({
          organizationSettings: {
            findFirst: jest.fn().mockResolvedValue(settings),
          },
        }),
    } as any);
  it("returns only current VAT and enabled manual methods, never settings or bank account details", async () => {
    const handler = handlerFor({
      vatRate: new Prisma.Decimal("0.05"),
      payMethodCashEnabled: false,
      payMethodBankEnabled: true,
      payMethodMadaEnabled: true,
      payMethodTabbyEnabled: false,
      bankTransferAccounts: [{ iban: "secret-account" }],
      companyNameAr: "Private settings",
    });
    expect(await handler.execute()).toEqual({
      vatRate: 0.05,
      paymentMethods: ["BANK_TRANSFER", "MADA"],
    });
  });
  it("uses the existing zero VAT and manual method defaults when no settings row exists", async () => {
    expect(await handlerFor(null).execute()).toEqual({
      vatRate: 0,
      paymentMethods: ["CASH", "BANK_TRANSFER"],
    });
  });
  it("preserves an explicit all-methods-disabled configuration", async () => {
    expect(
      await handlerFor({
        vatRate: 0,
        payMethodCashEnabled: false,
        payMethodBankEnabled: false,
        payMethodMadaEnabled: false,
        payMethodTabbyEnabled: false,
      }).execute(),
    ).toEqual({ vatRate: 0, paymentMethods: [] });
  });
});
