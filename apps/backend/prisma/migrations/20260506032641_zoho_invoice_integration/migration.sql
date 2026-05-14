-- CreateTable
CREATE TABLE "ZohoContactLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "deqahPersonId" TEXT NOT NULL,
    "zohoContactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoContactLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoInvoiceLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "deqahInvoiceId" TEXT,
    "deqahBookingId" TEXT,
    "zohoInvoiceId" TEXT NOT NULL,
    "zohoCustomerId" TEXT NOT NULL,
    "zohoOrganizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "invoiceUrl" TEXT,
    "pdfUrl" TEXT,
    "viewedAt" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoInvoiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoCreditNoteLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "zohoInvoiceLinkId" TEXT NOT NULL,
    "deqahRefundRequestId" TEXT,
    "zohoCreditNoteId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZohoCreditNoteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZohoWebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZohoWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZohoContactLink_organizationId_idx" ON "ZohoContactLink"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ZohoContactLink_organizationId_deqahPersonId_key" ON "ZohoContactLink"("organizationId", "deqahPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "ZohoContactLink_organizationId_zohoContactId_key" ON "ZohoContactLink"("organizationId", "zohoContactId");

-- CreateIndex
CREATE UNIQUE INDEX "ZohoInvoiceLink_zohoInvoiceId_key" ON "ZohoInvoiceLink"("zohoInvoiceId");

-- CreateIndex
CREATE INDEX "ZohoInvoiceLink_organizationId_status_idx" ON "ZohoInvoiceLink"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ZohoInvoiceLink_zohoCustomerId_idx" ON "ZohoInvoiceLink"("zohoCustomerId");

-- CreateIndex
CREATE INDEX "ZohoInvoiceLink_deqahInvoiceId_idx" ON "ZohoInvoiceLink"("deqahInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ZohoInvoiceLink_organizationId_scope_deqahInvoiceId_key" ON "ZohoInvoiceLink"("organizationId", "scope", "deqahInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ZohoCreditNoteLink_zohoCreditNoteId_key" ON "ZohoCreditNoteLink"("zohoCreditNoteId");

-- CreateIndex
CREATE INDEX "ZohoCreditNoteLink_organizationId_idx" ON "ZohoCreditNoteLink"("organizationId");

-- CreateIndex
CREATE INDEX "ZohoCreditNoteLink_zohoInvoiceLinkId_idx" ON "ZohoCreditNoteLink"("zohoInvoiceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "ZohoCreditNoteLink_organizationId_deqahRefundRequestId_key" ON "ZohoCreditNoteLink"("organizationId", "deqahRefundRequestId");

-- CreateIndex
CREATE INDEX "ZohoWebhookEvent_organizationId_eventType_idx" ON "ZohoWebhookEvent"("organizationId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ZohoWebhookEvent_organizationId_eventId_key" ON "ZohoWebhookEvent"("organizationId", "eventId");

-- AddForeignKey
ALTER TABLE "ZohoCreditNoteLink" ADD CONSTRAINT "ZohoCreditNoteLink_zohoInvoiceLinkId_fkey" FOREIGN KEY ("zohoInvoiceLinkId") REFERENCES "ZohoInvoiceLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
