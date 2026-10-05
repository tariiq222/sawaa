import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  DiscountType,
  PackagePurchaseStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { DEFAULT_ORG_ID } from "../../../../common/constants";
import {
  InitPackagePurchaseHandler,
  selfPurchaseFingerprint,
} from "./init-package-purchase.handler";
import { resolvePackageGroupOfferings } from "../../../org-experience/session-packages/package-group-offering.helper";

jest.mock("../../../org-experience/session-packages/package-group-offering.helper", () => ({
  resolvePackageGroupOfferings: jest.fn(),
}));

const PACKAGE_ID = "00000000-0000-4000-a000-000000000001";
const CLIENT_ID = "00000000-0000-4000-a000-000000000002";
const BRANCH_ID = "00000000-0000-4000-a000-000000000003";
const SERVICE_ID = "00000000-0000-4000-a000-000000000005";
const EMPLOYEE_ID = "00000000-0000-4000-a000-000000000004";
const DURATION_OPTION_ID = "00000000-0000-4000-a000-000000000006";
const PURCHASE_ID = "00000000-0000-4000-a000-000000000010";
const INVOICE_ID = "00000000-0000-4000-a000-000000000011";
const PAYMENT_ID = "00000000-0000-4000-a000-000000000012";

const ITEM = {
  id: "item-1",
  packageId: PACKAGE_ID,
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
  unitPrice: new Prisma.Decimal(10_000),
  paidQuantity: 4,
  freeQuantity: 1,
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(10),
  sortOrder: 0,
  constraints: [],
};

const PACKAGE_ROW = {
  id: PACKAGE_ID,
  nameAr: "باقة العائلة",
  nameEn: "Family Pack",
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(10),
  isActive: true,
  isPublic: true,
  archivedAt: null,
  items: [ITEM],
};

const FINAL_PRICE = 36_000;

const GROUPED_PACKAGE_ROW = {
  ...PACKAGE_ROW,
  modelVersion: "GROUPED_V2",
  groups: [{
    id: "group-1",
    key: "group-1",
    label: "Group 1",
    serviceId: SERVICE_ID,
    employeeId: EMPLOYEE_ID,
    sequenceMode: "ORDERED",
    sortOrder: 0,
    dependsOnGroupId: null,
    items: [{
      id: "group-item-1",
      groupId: "group-1",
      sessionPosition: 0,
      durationOptionId: DURATION_OPTION_ID,
      unitPrice: new Prisma.Decimal(0),
      constraints: [{
        dimension: "DELIVERY_TYPE",
        mode: "INCLUDE",
        targets: [{ targetId: "IN_PERSON" }],
      }],
    }],
  }],
  items: [{
    id: "group-item-1",
    groupId: "group-1",
    sessionPosition: 0,
    serviceId: SERVICE_ID,
    employeeId: EMPLOYEE_ID,
    durationOptionId: DURATION_OPTION_ID,
    unitPrice: new Prisma.Decimal(0),
    constraints: [{
      dimension: "DELIVERY_TYPE",
      mode: "INCLUDE",
      targets: [{ targetId: "IN_PERSON" }],
    }],
  }],
};

function buildTx() {
  return {
    packagePurchase: {
      create: jest.fn().mockResolvedValue({ id: PURCHASE_ID }),
    },
    invoice: { create: jest.fn().mockResolvedValue({ id: INVOICE_ID }) },
    payment: { create: jest.fn().mockResolvedValue({ id: PAYMENT_ID }) },
  };
}

function buildPrisma() {
  const prisma: Record<string, any> = {
    organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0 }) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: INVOICE_ID }]),
    sessionPackage: { findFirst: jest.fn().mockResolvedValue(PACKAGE_ROW) },
    client: { findFirst: jest.fn().mockResolvedValue({ id: CLIENT_ID }) },
    packagePurchase: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
        currency: 'SAR',
        status: 'DRAFT',
      }),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: PAYMENT_ID }),
      update: jest.fn().mockResolvedValue({ id: PAYMENT_ID }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  prisma.$transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
  return prisma;
}

function buildPricing(finalPrice = FINAL_PRICE) {
  return {
    compute: jest.fn().mockResolvedValue({
      subtotal: 40_000,
      discountAmount: 4_000,
      finalPrice,
      itemUnitPrices: [
        { durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 },
      ],
      lines: [{ durationOptionId: DURATION_OPTION_ID, net: finalPrice }],
    }),
  };
}

function buildMoyasar(
  url: string | null = "https://checkout.moyasar.com/invoices/abc",
) {
  return {
    createCheckoutInvoice: jest
      .fn()
      .mockImplementation(
        async (_organizationId: string, input: { amountHalalas: number; metadata: Record<string, string> }) => ({
          id: "moy-invoice-1",
          status: "initiated",
          amount: input.amountHalalas,
          currency: "SAR",
          url,
          metadata: input.metadata,
        }),
      ),
    getCheckoutInvoice: jest.fn().mockResolvedValue({
      id: "moy-invoice-existing",
      status: "expired",
      amount: FINAL_PRICE,
      currency: "SAR",
      url: null,
      metadata: { internalPaymentId: "old-pay" },
    }),
    findCheckoutInvoiceByMetadata: jest.fn().mockResolvedValue(null),
    getPaymentStatus: jest.fn().mockResolvedValue({
      id: "legacy-payment",
      status: "failed",
      amount: FINAL_PRICE,
      currency: "SAR",
    }),
  };
}

function buildHandler(
  prisma = buildPrisma(),
  pricing = buildPricing(),
  moyasar = buildMoyasar(),
  tx = buildTx(),
) {
  // Use one shared payment-create spy while exposing the full Prisma read/CAS
  // surface on every RlsTransactionService transaction client.
  tx.payment.create = prisma.payment.create;
  const transactionClient = {
    ...prisma,
    packagePurchase: { ...prisma.packagePurchase, create: tx.packagePurchase.create },
    invoice: { ...prisma.invoice, create: tx.invoice.create },
    payment: { ...prisma.payment, create: tx.payment.create },
  };
  const rls = {
    withTransaction: jest.fn((fn: (t: typeof transactionClient) => Promise<unknown>) =>
      fn(transactionClient),
    ),
  };
  const native = {execute:jest.fn().mockResolvedValue({paymentId:PAYMENT_ID,invoiceId:INVOICE_ID,config:{givenId:PAYMENT_ID,amount:FINAL_PRICE}})};
  const handler = new InitPackagePurchaseHandler(
    prisma as never,
    rls as never,
    pricing as never,
    moyasar as never,
    native as never,
  );
  return { handler, prisma, pricing, moyasar, tx, rls, native };
}

const cmd = () => ({
  idempotencyKey: "00000000-0000-4000-a000-000000000099",
  packageId: PACKAGE_ID,
  branchId: BRANCH_ID,
  clientId: CLIENT_ID,
});

describe("InitPackagePurchaseHandler", () => {
  afterEach(() => jest.clearAllMocks());

  describe("VAT from OrganizationSettings", () => {
    it("keeps amountPaid net and charges the gross invoice total when VAT is 15%", async () => {
      const { handler, prisma, tx, moyasar } = buildHandler();
      prisma.organizationSettings.findFirst.mockResolvedValue({ vatRate: "0.15" });

      await handler.execute(cmd());

      // 36000 × 0.15 = 5400 → gross 41400
      expect(Number(tx.packagePurchase.create.mock.calls[0][0].data.amountPaid)).toBe(FINAL_PRICE);
      const invoiceData = tx.invoice.create.mock.calls[0][0].data;
      expect(Number(invoiceData.vatRate)).toBe(0.15);
      expect(Number(invoiceData.vatAmt)).toBe(5_400);
      expect(Number(invoiceData.total)).toBe(41_400);
      expect(Number(tx.payment.create.mock.calls[0][0].data.amount)).toBe(41_400);
      expect(moyasar.createCheckoutInvoice).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        expect.objectContaining({ amountHalalas: 41_400 }),
      );
    });

    it("charges the net price when VAT is 0", async () => {
      const { handler, tx, moyasar } = buildHandler();

      await handler.execute(cmd());

      expect(Number(tx.invoice.create.mock.calls[0][0].data.vatAmt)).toBe(0);
      expect(moyasar.createCheckoutInvoice).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        expect.objectContaining({ amountHalalas: FINAL_PRICE }),
      );
    });
  });

  describe("happy path — self-purchase init", () => {
    it("freezes the price, creates a PENDING purchase, an invoice + PENDING payment, and returns the Moyasar redirect", async () => {
      const { handler, prisma, tx, moyasar, pricing } = buildHandler();

      const result = await handler.execute(cmd());

      // Price frozen via the same service the catalog/reception use.
      expect(pricing.compute).toHaveBeenCalledTimes(1);

      // Purchase is PENDING (NOT consumable) and carries the snapshot.
      const purchaseData = tx.packagePurchase.create.mock.calls[0][0].data;
      expect(purchaseData.status).toBe(PackagePurchaseStatus.PENDING);
      expect(Number(purchaseData.subtotalSnapshot)).toBe(40_000);
      expect(Number(purchaseData.amountPaid)).toBe(FINAL_PRICE);
      expect(purchaseData.idempotencyKey).toBe(cmd().idempotencyKey);
      expect(purchaseData.requestFingerprint).toBe(
        selfPurchaseFingerprint(cmd()),
      );
      expect(purchaseData.creditSnapshot).toEqual([
        {
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          durationOptionId: DURATION_OPTION_ID,
          unitPriceSnapshot: 10_000,
          // Net paid for the item's sessions, frozen before payment.
          netValue: FINAL_PRICE,
          totalQuantity: 5,
          constraints: [],
        },
      ]);

      // Invoice linked via packagePurchaseId, VAT=0, DRAFT (awaiting payment).
      const invoiceData = tx.invoice.create.mock.calls[0][0].data;
      expect(invoiceData.packagePurchaseId).toBe(PURCHASE_ID);
      expect(invoiceData.bookingId).toBeNull();
      expect(Number(invoiceData.vatRate)).toBe(0);
      expect(Number(invoiceData.total)).toBe(FINAL_PRICE);
      expect(invoiceData.status).toBe("DRAFT");

      // PENDING payment keyed by client-pkg:<invoice>.
      const paymentData = tx.payment.create.mock.calls[0][0].data;
      expect(paymentData.status).toBe(PaymentStatus.PENDING);
      expect(paymentData.idempotencyKey).toBe(`client-pkg:${INVOICE_ID}`);
      expect(paymentData.gatewayRef).toBeUndefined();

      // Moyasar called with halalas amount + metadata the UNCHANGED webhook reads.
      expect(moyasar.createCheckoutInvoice).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        expect.objectContaining({
          amountHalalas: FINAL_PRICE,
          currency: "SAR",
          successUrl: expect.stringContaining("/packages/payment-callback"),
          backUrl: expect.stringContaining("/packages/payment-callback"),
          metadata: expect.objectContaining({
            invoiceId: INVOICE_ID,
            packagePurchaseId: PURCHASE_ID,
            source: "self-purchase",
            internalPaymentId: PAYMENT_ID,
          }),
        }),
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: PAYMENT_ID,
          status: PaymentStatus.PENDING,
          gatewayRef: null,
        },
        data: { gatewayRef: "moy-invoice-1" },
      });

      expect(result).toEqual({
        purchaseId: PURCHASE_ID,
        invoiceId: INVOICE_ID,
        paymentId: PAYMENT_ID,
        redirectUrl: "https://checkout.moyasar.com/invoices/abc",
      });
    });

    it("does NOT create any PackageCredit at init time (credits are issued only on webhook activation)", async () => {
      const tx = buildTx() as ReturnType<typeof buildTx> & {
        packageCredit?: unknown;
      };
      const { handler } = buildHandler(
        buildPrisma(),
        buildPricing(),
        buildMoyasar(),
        tx,
      );

      await handler.execute(cmd());

      // The transaction object has no packageCredit method — the handler must not
      // attempt to create credits before payment.
      expect(tx.packageCredit).toBeUndefined();
    });

    it("persists the hosted invoice id on the internal payment", async () => {
      const prisma = buildPrisma();
      const tx = buildTx();
      const moyasar = buildMoyasar();
      const { handler } = buildHandler(prisma, buildPricing(), moyasar, tx);

      await handler.execute(cmd());

      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: PAYMENT_ID,
          status: PaymentStatus.PENDING,
          gatewayRef: null,
        },
        data: { gatewayRef: "moy-invoice-1" },
      });
    });
  });

  describe("package eligibility", () => {
    it("throws NotFoundException when the package is not public/active/non-archived", async () => {
      const prisma = buildPrisma();
      prisma.sessionPackage.findFirst.mockResolvedValue(null);
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    });

    it("scopes the package lookup to public + active + non-archived", async () => {
      const prisma = buildPrisma();
      const { handler } = buildHandler(prisma);

      await handler.execute(cmd());

      expect(prisma.sessionPackage.findFirst.mock.calls[0][0].where).toEqual({
        id: PACKAGE_ID,
        isPublic: true,
        isActive: true,
        archivedAt: null,
      });
    });

    it("throws NotFoundException when the client does not exist", async () => {
      const prisma = buildPrisma();
      prisma.client.findFirst.mockResolvedValue(null);
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(NotFoundException);
    });

    it("rejects a package below the gateway minimum (free / sub-1-SAR package)", async () => {
      const { handler, moyasar } = buildHandler(
        buildPrisma(),
        buildPricing(50),
      );

      await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it("rejects a zero-total GROUPED_V2 package before any purchase, invoice, payment, or gateway write", async () => {
      jest.mocked(resolvePackageGroupOfferings).mockResolvedValue([
        {
          key: "group-1",
          label: "Group 1",
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          sequenceMode: "ORDERED",
          dependsOnGroupKey: null,
          sessions: [{
            key: "group-item-1",
            position: 0,
            durationOptionId: DURATION_OPTION_ID,
            deliveryType: "IN_PERSON",
            unitPrice: 0,
            durationMins: 60,
            listPrice: 0,
            effectivePrice: 0,
            serviceName: "Service",
            employeeName: "Employee",
          }],
        },
      ] as never);
      const prisma = buildPrisma();
      prisma.sessionPackage.findFirst.mockResolvedValue(GROUPED_PACKAGE_ROW);
      const { handler, tx, moyasar } = buildHandler(prisma, buildPricing(0));

      await expect(handler.execute(cmd())).rejects.toThrow(/below the gateway minimum/i);
      expect(tx.packagePurchase.create).not.toHaveBeenCalled();
      expect(tx.invoice.create).not.toHaveBeenCalled();
      expect(tx.payment.create).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });
  });

  describe("gateway edge cases", () => {
    it("throws when Moyasar returns no redirect URL", async () => {
      const prisma = buildPrisma();
      const { handler } = buildHandler(
        prisma,
        buildPricing(),
        buildMoyasar(null),
      );

      await expect(handler.execute(cmd())).rejects.toThrow(/redirect URL/i);
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: PAYMENT_ID,
          status: PaymentStatus.PENDING,
          gatewayRef: null,
        },
        data: { gatewayRef: "moy-invoice-1" },
      });
    });

    it("propagates a Moyasar create failure (no redirect issued)", async () => {
      const prisma = buildPrisma();
      const moyasar = buildMoyasar();
      moyasar.createCheckoutInvoice.mockRejectedValue(new Error("gateway 500"));
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).rejects.toThrow("gateway 500");
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("idempotency — in-flight PENDING reuse", () => {
    it("does not let a legacy unkeyed PENDING row block a new idempotent checkout", async () => {
      const prisma = buildPrisma();
      const legacyPending = {
        id: "00000000-0000-4000-a000-000000000013",
        idempotencyKey: null,
        requestFingerprint: null,
      };
      prisma.packagePurchase.findFirst.mockImplementation(({ where }: { where: Record<string, any> }) =>
        where.idempotencyKey?.not === null
          ? Promise.resolve(null)
          : Promise.resolve(legacyPending),
      );
      const tx = buildTx();
      const { handler, moyasar } = buildHandler(
        prisma,
        buildPricing(),
        buildMoyasar(),
        tx,
      );

      await expect(handler.execute(cmd())).resolves.toMatchObject({
        purchaseId: PURCHASE_ID,
        invoiceId: INVOICE_ID,
      });

      expect(tx.packagePurchase.create).toHaveBeenCalledTimes(1);
      expect(moyasar.createCheckoutInvoice).toHaveBeenCalledTimes(1);
    });

    it.each(["HOSTED","NATIVE"])("retries frozen purchase in %s mode without repricing live catalog", async (mode) => {
      const prisma = buildPrisma();
      const fingerprint = selfPurchaseFingerprint(cmd());
      prisma.packagePurchase.findUnique.mockResolvedValue({
        id: PURCHASE_ID,
        requestFingerprint: fingerprint,
        status: PackagePurchaseStatus.PENDING,
        subtotalSnapshot: new Prisma.Decimal(40_000),
        discountSnapshot: new Prisma.Decimal(4_000),
        amountPaid: new Prisma.Decimal(FINAL_PRICE),
        creditSnapshot: [
          {
            serviceId: SERVICE_ID,
            employeeId: EMPLOYEE_ID,
            durationOptionId: DURATION_OPTION_ID,
            unitPriceSnapshot: 10_000,
            totalQuantity: 5,
            constraints: [],
          },
        ],
      });
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: cmd().idempotencyKey,
        requestFingerprint: fingerprint,
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
      });
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: "old-pay",
          status: PaymentStatus.FAILED,
          gatewayRef: null,
        })
        .mockResolvedValue(null);
      prisma.payment.findUnique.mockResolvedValue({
        status: PaymentStatus.FAILED,
        gatewayRef: null,
      });
      const pricing = buildPricing(99_999);
      const moyasar = buildMoyasar();
      const { handler } = buildHandler(prisma, pricing, moyasar);

      if(mode==="NATIVE") await handler.execute(cmd(),{mode:"NATIVE",fingerprint:"config-hash"});
      else await handler.execute(cmd());

      expect(prisma.sessionPackage.findFirst).not.toHaveBeenCalled();
      expect(pricing.compute).not.toHaveBeenCalled();
      if(mode==="NATIVE") expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
      else expect(moyasar.createCheckoutInvoice).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        expect.objectContaining({ amountHalalas: FINAL_PRICE }),
      );
    });

    it("lets a keyed retry reuse its frozen gross total even when the current rate would put it below the gateway minimum", async () => {
      // Net 90 halalas was accepted at 15% VAT (gross 104). VAT is now 0, so
      // the current rate alone would compute 90 < 100.
      const prisma = buildPrisma();
      const fingerprint = selfPurchaseFingerprint(cmd());
      prisma.packagePurchase.findUnique.mockResolvedValue({
        id: PURCHASE_ID, requestFingerprint: fingerprint, status: PackagePurchaseStatus.PENDING,
        subtotalSnapshot: new Prisma.Decimal(90), discountSnapshot: new Prisma.Decimal(0), amountPaid: new Prisma.Decimal(90),
        creditSnapshot: [{ serviceId: SERVICE_ID, employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID, unitPriceSnapshot: 90, totalQuantity: 1, constraints: [] }],
      });
      prisma.packagePurchase.findFirst.mockResolvedValue({ id: PURCHASE_ID, idempotencyKey: cmd().idempotencyKey, requestFingerprint: fingerprint });
      prisma.invoice.findFirst.mockResolvedValue({ id: INVOICE_ID, total: 104 });
      prisma.invoice.findUnique.mockResolvedValue({ id: INVOICE_ID, total: 104, currency: "SAR", status: "DRAFT" });
      prisma.payment.findFirst.mockResolvedValueOnce({ id: "old-pay", status: PaymentStatus.FAILED, gatewayRef: null }).mockResolvedValue(null);
      prisma.payment.findUnique.mockResolvedValue({ status: PaymentStatus.FAILED, gatewayRef: null });
      const moyasar = buildMoyasar();
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).resolves.toMatchObject({ purchaseId: PURCHASE_ID });
      expect(moyasar.createCheckoutInvoice).toHaveBeenCalledWith(DEFAULT_ORG_ID, expect.objectContaining({ amountHalalas: 104 }));
    });

    it("rejects a second checkout key while the same client/package still has a PENDING purchase", async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: "00000000-0000-4000-a000-000000000098",
        requestFingerprint: selfPurchaseFingerprint(cmd()),
      });
      const { handler, moyasar, tx } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(ConflictException);
      expect(tx.packagePurchase.create).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it("reuses an existing PENDING purchase + invoice and re-issues a fresh payment instead of creating duplicates", async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: cmd().idempotencyKey,
        requestFingerprint: selfPurchaseFingerprint(cmd()),
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
      });
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: "old-pay",
          status: PaymentStatus.PENDING,
          gatewayRef: "terminal-failed-session",
        })
        .mockResolvedValue(null);
      prisma.payment.findUnique.mockResolvedValue({
        status: PaymentStatus.PENDING,
        gatewayRef: "terminal-failed-session",
      });
      const tx = buildTx();
      const { handler } = buildHandler(
        prisma,
        buildPricing(),
        buildMoyasar(),
        tx,
      );

      const result = await handler.execute(cmd());

      // No NEW purchase/invoice created in a transaction — reuse path.
      expect(tx.packagePurchase.create).not.toHaveBeenCalled();
      expect(tx.invoice.create).not.toHaveBeenCalled();
      // Stale PENDING payment deleted, fresh one created.
      expect(prisma.payment.delete).toHaveBeenCalledWith({
        where: { id: "old-pay" },
      });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result.purchaseId).toBe(PURCHASE_ID);
      expect(result.invoiceId).toBe(INVOICE_ID);
    });

    it("refuses to re-charge a purchase whose payment already COMPLETED", async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: cmd().idempotencyKey,
        requestFingerprint: selfPurchaseFingerprint(cmd()),
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
      });
      prisma.payment.findFirst.mockResolvedValue({
        id: "paid",
        status: PaymentStatus.COMPLETED,
      });
      const { handler } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(BadRequestException);
    });

    it("refuses to re-charge a PAID invoice while package activation is still pending", async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: cmd().idempotencyKey,
        requestFingerprint: selfPurchaseFingerprint(cmd()),
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
        status: "PAID",
      });
      prisma.invoice.findUnique.mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
        currency: "SAR",
        status: "PAID",
      });
      prisma.payment.findFirst.mockResolvedValue(null);
      const { handler, moyasar } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(
        /already been paid/i,
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it.each(["VOID", "PARTIALLY_REFUNDED", "REFUNDED"])(
      "refuses to reserve against a locked %s package invoice",
      async (status) => {
        const prisma = buildPrisma();
        prisma.packagePurchase.findFirst.mockResolvedValue({
          id: PURCHASE_ID,
          idempotencyKey: cmd().idempotencyKey,
          requestFingerprint: selfPurchaseFingerprint(cmd()),
        });
        prisma.invoice.findFirst.mockResolvedValue({ id: INVOICE_ID });
        prisma.invoice.findUnique.mockResolvedValue({
          id: INVOICE_ID,
          total: FINAL_PRICE,
          currency: "SAR",
          status,
        });
        const { handler, moyasar } = buildHandler(prisma);

        await expect(handler.execute(cmd())).rejects.toThrow(
          "This purchase has already been paid",
        );
        expect(prisma.payment.create).not.toHaveBeenCalled();
        expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
      },
    );

    it("blocks a package reservation when another client payment already reserves the invoice", async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: cmd().idempotencyKey,
        requestFingerprint: selfPurchaseFingerprint(cmd()),
      });
      prisma.invoice.findFirst.mockResolvedValue({ id: INVOICE_ID });
      prisma.payment.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "generic-card-reservation" });
      const { handler, moyasar } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(
        "Another payment is already pending",
      );
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it("finds a COMPLETED invoice payment even after the webhook replaced its checkout idempotency key", async () => {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: cmd().idempotencyKey,
        requestFingerprint: selfPurchaseFingerprint(cmd()),
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
        status: "DRAFT",
      });
      prisma.payment.findFirst.mockImplementation(({ where }: { where: Record<string, any> }) =>
        where.idempotencyKey
          ? Promise.resolve(null)
          : Promise.resolve({
              id: "paid-by-webhook",
              status: PaymentStatus.COMPLETED,
              gatewayRef: "moy-paid",
            }),
      );
      const { handler, moyasar } = buildHandler(prisma);

      await expect(handler.execute(cmd())).rejects.toThrow(
        /already been paid/i,
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });
  });

  // ─── P1-6: G3 reconciliation before deleting a stale gateway session ──────
  describe("P1-6 — gateway reconciliation on in-flight PENDING reuse", () => {
    function buildReusePrisma(gatewayRef: string | null) {
      const prisma = buildPrisma();
      prisma.packagePurchase.findFirst.mockResolvedValue({
        id: PURCHASE_ID,
        idempotencyKey: cmd().idempotencyKey,
        requestFingerprint: selfPurchaseFingerprint(cmd()),
      });
      prisma.invoice.findFirst.mockResolvedValue({
        id: INVOICE_ID,
        total: FINAL_PRICE,
      });
      prisma.payment.findFirst
        .mockResolvedValueOnce({
          id: "old-pay",
          status: PaymentStatus.PENDING,
          gatewayRef,
        })
        .mockResolvedValue(null);
      prisma.payment.findUnique.mockResolvedValue({
        status: PaymentStatus.PENDING,
        gatewayRef,
      });
      return prisma;
    }

    it("rejects (no re-charge) when the in-flight gateway session is already paid", async () => {
      const prisma = buildReusePrisma("moy-live-1");
      const moyasar = buildMoyasar();
      moyasar.getCheckoutInvoice.mockResolvedValue({
        id: "moy-live-1",
        status: "paid",
        amount: FINAL_PRICE,
        currency: "SAR",
        url: "https://checkout.moyasar.com/invoices/moy-live-1",
        metadata: { internalPaymentId: "old-pay" },
      });
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).rejects.toThrow(ConflictException);
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it("reuses the same hosted URL when the package checkout is still unpaid", async () => {
      const prisma = buildReusePrisma("moy-live-2");
      const moyasar = buildMoyasar();
      moyasar.getCheckoutInvoice.mockResolvedValue({
        id: "moy-live-2",
        status: "initiated",
        amount: FINAL_PRICE,
        currency: "SAR",
        url: "https://checkout.moyasar.com/invoices/moy-live-2",
        metadata: { internalPaymentId: "old-pay" },
      });
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).resolves.toMatchObject({
        purchaseId: PURCHASE_ID,
        invoiceId: INVOICE_ID,
        redirectUrl: "https://checkout.moyasar.com/invoices/moy-live-2",
      });
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it("discards and recreates when the in-flight gateway session is terminally failed", async () => {
      const prisma = buildReusePrisma("moy-dead-1");
      const moyasar = buildMoyasar();
      moyasar.getCheckoutInvoice.mockResolvedValue({
        id: "moy-dead-1",
        status: "expired",
        amount: FINAL_PRICE,
        currency: "SAR",
        url: null,
        metadata: { internalPaymentId: "old-pay" },
      });
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      const result = await handler.execute(cmd());

      expect(moyasar.getCheckoutInvoice).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        "moy-dead-1",
      );
      expect(prisma.payment.delete).toHaveBeenCalledWith({
        where: { id: "old-pay" },
      });
      expect(prisma.payment.create).toHaveBeenCalled();
      expect(result.purchaseId).toBe(PURCHASE_ID);
    });

    it("fails closed (ConflictException) when the gateway status cannot be verified", async () => {
      const prisma = buildReusePrisma("moy-unknown-1");
      const moyasar = buildMoyasar();
      moyasar.getCheckoutInvoice.mockRejectedValue(new Error("gateway 500"));
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).rejects.toThrow(ConflictException);
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it("blocks a new package checkout while a legacy payment session is initiated", async () => {
      const prisma = buildReusePrisma("legacy-payment-id");
      const moyasar = buildMoyasar();
      moyasar.getCheckoutInvoice.mockRejectedValue(
        new NotFoundException("hosted invoice not found"),
      );
      moyasar.findCheckoutInvoiceByMetadata.mockResolvedValue(null);
      moyasar.getPaymentStatus.mockResolvedValue({
        id: "legacy-payment-id",
        status: "initiated",
        amount: FINAL_PRICE,
        currency: "SAR",
      });
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).rejects.toThrow(ConflictException);
      expect(moyasar.getPaymentStatus).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        "legacy-payment-id",
      );
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });

    it("recovers an unknown create outcome by internalPaymentId", async () => {
      const prisma = buildPrisma();
      const moyasar = buildMoyasar();
      moyasar.createCheckoutInvoice.mockRejectedValue(new Error("timeout"));
      moyasar.findCheckoutInvoiceByMetadata.mockResolvedValue({
        id: "moy-recovered",
        status: "initiated",
        amount: FINAL_PRICE,
        currency: "SAR",
        url: "https://checkout.moyasar.com/invoices/recovered",
        metadata: { internalPaymentId: PAYMENT_ID },
      });
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).resolves.toMatchObject({
        paymentId: PAYMENT_ID,
        redirectUrl: "https://checkout.moyasar.com/invoices/recovered",
      });
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(moyasar.findCheckoutInvoiceByMetadata).toHaveBeenCalledWith(
        DEFAULT_ORG_ID,
        PAYMENT_ID,
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: {
          id: PAYMENT_ID,
          status: PaymentStatus.PENDING,
          gatewayRef: null,
        },
        data: { gatewayRef: "moy-recovered" },
      });
    });

    it("fails closed when metadata reconciliation for an orphan attempt errors", async () => {
      const prisma = buildReusePrisma(null);
      const moyasar = buildMoyasar();
      moyasar.findCheckoutInvoiceByMetadata.mockRejectedValue(new Error("gateway 500"));
      const { handler } = buildHandler(prisma, buildPricing(), moyasar);

      await expect(handler.execute(cmd())).rejects.toThrow(ConflictException);

      expect(moyasar.getCheckoutInvoice).not.toHaveBeenCalled();
      expect(prisma.payment.delete).not.toHaveBeenCalled();
      expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();
    });
  });
});


describe('native package initialization',()=>{
  it('binds the givenId before returning without creating a hosted checkout',async()=>{
    const {handler,prisma,moyasar,native}=buildHandler();
    const result=await handler.execute(cmd(),{mode:'NATIVE',fingerprint:'config-hash'});
    expect(result).not.toHaveProperty('redirectUrl');expect(result.purchaseId).toBe(PURCHASE_ID);
    const data=prisma.payment.create.mock.calls[0][0].data;
    expect(data.id).toBe(data.gatewayRef);expect(data.id).toMatch(/^[a-f0-9-]{36}$/);expect(data.nativeConfigFingerprint).toBe('config-hash');
    expect(moyasar.createCheckoutInvoice).not.toHaveBeenCalled();expect(native.execute).toHaveBeenCalledWith({clientId:CLIENT_ID,invoiceId:INVOICE_ID});
  });
  it('returns typed already-completed identity for a paid purchase key',async()=>{
    const {handler,prisma}=buildHandler();prisma.packagePurchase.findUnique.mockResolvedValue({id:PURCHASE_ID,status:'ACTIVE',requestFingerprint:selfPurchaseFingerprint(cmd())});
    try {await handler.execute(cmd(),{mode:'NATIVE',fingerprint:'config-hash'});throw new Error('expected rejection');}
    catch(error:any){expect(error.getResponse()).toMatchObject({code:'PAYMENT_ALREADY_COMPLETED',purchaseId:PURCHASE_ID});}
  });
  it('returns native paid identity while package activation is still pending',async()=>{
    const {handler,prisma}=buildHandler();
    prisma.packagePurchase.findUnique.mockResolvedValue({id:PURCHASE_ID,requestFingerprint:selfPurchaseFingerprint(cmd()),status:'PENDING',subtotalSnapshot:40000,discountSnapshot:4000,amountPaid:FINAL_PRICE,creditSnapshot:[{serviceId:SERVICE_ID,employeeId:EMPLOYEE_ID,durationOptionId:DURATION_OPTION_ID,unitPriceSnapshot:10000,totalQuantity:5,constraints:[]}]});
    prisma.packagePurchase.findFirst.mockResolvedValue({id:PURCHASE_ID,idempotencyKey:cmd().idempotencyKey,requestFingerprint:selfPurchaseFingerprint(cmd())});
    prisma.invoice.findFirst.mockResolvedValue({id:INVOICE_ID});prisma.invoice.findUnique.mockResolvedValue({id:INVOICE_ID,status:'PAID'});
    await expect(handler.execute(cmd(),{mode:'NATIVE',fingerprint:'config-hash'})).rejects.toMatchObject({response:expect.objectContaining({code:'PAYMENT_ALREADY_COMPLETED',purchaseId:PURCHASE_ID})});
  });

});
