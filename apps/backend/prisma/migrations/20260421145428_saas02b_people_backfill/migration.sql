-- SaaS-02b: assign every pre-existing row to the default organization.
-- Order matters: set Client + Employee first, then denormalize to children.

UPDATE "Client"   SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Employee" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;

-- Child tables inherit from the parent Employee. Avoids hardcoding the default
-- UUID twice: if Employee rows ever carry a different org, children stay aligned.
UPDATE "EmployeeBranch" eb
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE eb."employeeId" = e.id AND eb."organizationId" IS NULL;

UPDATE "EmployeeService" es
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE es."employeeId" = e.id AND es."organizationId" IS NULL;

UPDATE "EmployeeAvailability" ea
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE ea."employeeId" = e.id AND ea."organizationId" IS NULL;

UPDATE "EmployeeAvailabilityException" ex
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE ex."employeeId" = e.id AND ex."organizationId" IS NULL;

-- ClientRefreshToken inherits from its parent Client.
UPDATE "ClientRefreshToken" crt
  SET "organizationId" = c."organizationId"
  FROM "Client" c
  WHERE crt."clientId" = c.id AND crt."organizationId" IS NULL;
