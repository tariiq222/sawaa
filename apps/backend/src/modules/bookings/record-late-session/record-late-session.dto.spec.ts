import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { RecordLateSessionDto } from "./record-late-session.dto";

const base = {
  clientId: "550e8400-e29b-41d4-a716-446655440001",
  branchId: "550e8400-e29b-41d4-a716-446655440002",
  employeeId: "550e8400-e29b-41d4-a716-446655440003",
  serviceId: "550e8400-e29b-41d4-a716-446655440004",
  deliveryType: "IN_PERSON",
  scheduledAt: "2026-09-01T10:00:00Z",
  durationMins: 60,
  status: "COMPLETED",
  amountHalalas: 40000,
  paymentMode: "UNPAID",
  creationIdempotencyKey: "late-session-1",
};
const errors = (data: object) =>
  validate(plainToInstance(RecordLateSessionDto, data), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
describe("RecordLateSessionDto", () => {
  it("accepts unpaid and factual partial receipt requests", async () => {
    expect(await errors(base)).toHaveLength(0);
    expect(
      await errors({
        ...base,
        paymentMode: "PREVIOUSLY_RECEIVED",
        paymentMethod: "CASH",
        paymentAmountHalalas: 15000,
        receivedAt: "2026-08-28T10:00:00Z",
        receiptEvidenceRef: "receipt-1",
        receiptEntryReason: "Paper record",
      }),
    ).toHaveLength(0);
  });
  it.each([
    { paymentMethod: "CASH" },
    { paymentAmountHalalas: 100 },
    { receivedAt: "2026-08-28T10:00:00Z" },
    { receiptEvidenceRef: "proof" },
    { receiptEntryReason: "reason" },
    { createdAt: "2020-01-01" },
    { gatewayRef: "manual" },
    { isHistoricalImport: true },
    { amountHalalas: 1.2 },
    { durationMins: 0 },
  ])(
    "rejects forbidden unpaid/system or invalid numeric fields %j",
    async (extra) => {
      expect((await errors({ ...base, ...extra })).length).toBeGreaterThan(0);
    },
  );
  it.each([
    { paymentMode: "PREVIOUSLY_RECEIVED" },
    {
      paymentMode: "COLLECT_NOW",
      paymentMethod: null,
      paymentAmountHalalas: null,
    },
    {
      paymentMode: "COLLECT_NOW",
      paymentMethod: "ONLINE_CARD",
      paymentAmountHalalas: 40000,
    },
    {
      paymentMode: "COLLECT_NOW",
      paymentMethod: "CASH",
      paymentAmountHalalas: 40000,
      receivedAt: "2026-09-01T00:00:00Z",
    },
    { status: "CANCELLED" },
    { status: "NO_SHOW" },
    { status: "COMPLETED", cancelledAt: "2026-09-01T00:00:00Z" },
  ])(
    "rejects incomplete or inappropriate conditional fields %j",
    async (extra) => {
      expect((await errors({ ...base, ...extra })).length).toBeGreaterThan(0);
    },
  );
});

const invalidTimestamps = [
  "2026-02-31T10:00:00Z",
  "2026-W05-1T10:00:00Z",
  "2026-032T10:00:00Z",
  "2026-09-01",
  "2026-09-01T10:00:00",
  "2026-09-01T24:00:00Z",
];
describe.each(["scheduledAt", "receivedAt", "cancelledAt", "noShowAt"])(
  "strict actual timestamp %s",
  (field) => {
    const context =
      field === "receivedAt"
        ? {
            paymentMode: "PREVIOUSLY_RECEIVED",
            paymentMethod: "CASH",
            paymentAmountHalalas: 15000,
            receiptEvidenceRef: "paper",
            receiptEntryReason: "ledger",
          }
        : field === "cancelledAt"
          ? {
              status: "CANCELLED",
              amountHalalas: 0,
              cancellationReason: "reason",
            }
          : field === "noShowAt"
            ? { status: "NO_SHOW", amountHalalas: 0 }
            : {};
    it.each(invalidTimestamps)(
      "rejects unsupported or impossible calendar value %s",
      async (value) => {
        expect(
          (await errors({ ...base, ...context, [field]: value })).length,
        ).toBeGreaterThan(0);
      },
    );
    it("accepts valid leap-day timestamp with explicit offset", async () => {
      expect(
        await errors({
          ...base,
          ...context,
          [field]: "2024-02-29T13:12:11.123+03:00",
        }),
      ).toHaveLength(0);
    });
  },
);
