-- Prevent concurrent onboarding requests from creating duplicate employee emails.
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
