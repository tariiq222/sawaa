-- CreateTable
CREATE TABLE "EmployeeBreak" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeBreak_employeeId_dayOfWeek_idx" ON "EmployeeBreak"("employeeId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "EmployeeBreak_organizationId_idx" ON "EmployeeBreak"("organizationId");

-- AddForeignKey
ALTER TABLE "EmployeeBreak" ADD CONSTRAINT "EmployeeBreak_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
