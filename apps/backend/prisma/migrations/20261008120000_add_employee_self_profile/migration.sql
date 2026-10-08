ALTER TABLE "Employee" ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "EmployeeContactChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "channel" "OtpChannel" NOT NULL,
  "identifier" TEXT NOT NULL,
  "previousValue" TEXT,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "ready" BOOLEAN NOT NULL DEFAULT false,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeContactChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmployeeContactChallenge_userId_channel_consumedAt_idx" ON "EmployeeContactChallenge"("userId", "channel", "consumedAt");
CREATE INDEX "EmployeeContactChallenge_expiresAt_idx" ON "EmployeeContactChallenge"("expiresAt");
