# Group Program Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fully separate group counseling from the `Service` model via a standalone `GroupProgram` model (linked to `Department`); replace `GroupSession.serviceId` with `GroupSession.programId`; **delete the unrelated dead "capacity-based group-service" booking flow** that abused `Service.maxParticipants/minParticipants/reserveWithoutPayment`; then remove those now-unused group fields from `Service`.

**Architecture:** New `GroupProgram` model lives in `bookings.prisma`. `GroupSession` drops `serviceId` and gains a `programId` FK. `GroupProgram` carries `minParticipants`, `maxParticipants`, `defaultPrice` (halalas), `nameAr/En`, `descriptionAr/En`, `departmentId`, `isActive`. Scheduled group bookings store `Booking.programId` and `Booking.serviceId = null`.

> **Mid-execution correction (after Tasks 1–3 landed):** The codebase had TWO unrelated "group" systems. (1) The **scheduled GroupSession** flow — what we migrate to `GroupProgram`. (2) A **dead capacity-based group-service** flow: an individual `Booking` of a regular `Service` with `maxParticipants > 1` + `reserveWithoutPayment`, accumulated in `PENDING_GROUP_FILL` until `minParticipants`, then charged via `GroupSessionMinReachedHandler` → `group_session.min_reached` → finance `GroupSessionReadyHandler` → comms payment links. The scheduled flow never touches that machinery (it starts in `AWAITING_PAYMENT`/`CONFIRMED`). Per owner decision (full separation), system (2) is **deleted** (Tasks 4 + 4b + 6b), not migrated. The original plan's "convert min-reached/capacity to programId" rested on a wrong assumption and is replaced.

**Tech Stack:** NestJS 11 / Prisma 7 / PostgreSQL 16, Next.js 15 / React 19 / TanStack Query v5 / Zod, Expo SDK 55

---

## Global Constraints

- Migrations are **immutable** — never edit existing ones; always add a new migration.
- All amounts are stored as **integer halalas** (no decimals).
- All code and comments must be in **English**.
- `pnpm openapi:sync` must be run and committed after every backend endpoint change.
- Dashboard file line limit: 350 lines absolute; feature components ≤ 300.
- Dashboard RTL: use `ps-/pe-/ms-/me-` logical classes only — no hardcoded `left/right`.
- Dashboard colors: CSS token only — no hex, no `text-gray-*`.
- Icons: `@hugeicons/react` only in dashboard.
- i18n: every user-facing string via `t('key')` from `useLocale()`; run `pnpm i18n:verify` after any translation change.
- `Booking` model still needs a `serviceId` for **individual** bookings — we are NOT removing `Booking.serviceId`. Group bookings will set `Booking.serviceId = null` (it is already nullable in the schema) and instead carry `Booking.programId`.
- Security tiers from root CLAUDE.md apply: payments/auth are owner-only; migrations are high-tier.

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `apps/backend/prisma/migrations/<ts>_add_group_program/migration.sql` | Add `GroupProgram` table; add `programId` to `GroupSession` and `Booking`; drop `serviceId` from `GroupSession` |
| `apps/backend/src/modules/bookings/create-group-program/create-group-program.dto.ts` | DTO for creating a program |
| `apps/backend/src/modules/bookings/create-group-program/create-group-program.handler.ts` | Handler |
| `apps/backend/src/modules/bookings/create-group-program/create-group-program.handler.spec.ts` | Unit tests |
| `apps/backend/src/modules/bookings/list-group-programs/list-group-programs.handler.ts` | Handler |
| `apps/backend/src/modules/bookings/list-group-programs/list-group-programs.handler.spec.ts` | Unit tests |
| `apps/backend/src/api/dashboard/group-programs.controller.ts` | Dashboard controller (CRUD) |
| `apps/dashboard/components/features/group-programs/group-program-form-page.tsx` | Create/edit form |
| `apps/dashboard/app/(dashboard)/group-programs/page.tsx` | List page |
| `apps/dashboard/app/(dashboard)/group-programs/create/page.tsx` | Create page |
| `apps/dashboard/lib/api/group-programs.ts` | API calls |
| `apps/dashboard/lib/types/group-program.ts` | TS types |
| `apps/dashboard/lib/schemas/group-program.schema.ts` | Zod schema |
| `apps/dashboard/hooks/use-group-programs.ts` | TanStack Query hooks |
| `apps/dashboard/lib/translations/ar.group-programs.ts` | Arabic strings |
| `apps/dashboard/lib/translations/en.group-programs.ts` | English strings |

### Modified files
| Path | Change |
|---|---|
| `apps/backend/prisma/schema/bookings.prisma` | Add `GroupProgram` model; change `GroupSession.serviceId → programId`; add `Booking.programId` (nullable) |
| `apps/backend/src/modules/bookings/create-group-session/create-group-session.dto.ts` | `serviceId → programId` |
| `apps/backend/src/modules/bookings/create-group-session/create-group-session.handler.ts` | Validate program instead of service; store `programId` |
| `apps/backend/src/modules/bookings/create-group-session/create-group-session.handler.spec.ts` | Update mocks |
| `apps/backend/src/modules/bookings/get-group-session/get-group-session.handler.ts` | Resolve program instead of service |
| `apps/backend/src/modules/bookings/list-group-sessions/list-group-sessions.handler.ts` | Return `programId` |
| `apps/backend/src/modules/bookings/public/book-group-session.handler.ts` | Copy `programId` to `Booking`; remove `serviceId` copy |
| `apps/backend/src/modules/bookings/public/list-public-group-sessions.handler.ts` | Return `programId`; add `departmentId` for filtering |
| `apps/backend/src/modules/bookings/public/get-public-group-session.handler.ts` | Return program fields |
| `apps/backend/src/modules/bookings/group-session/group-session-capacity.service.ts` | Fetch `program.minParticipants` instead of `service.minParticipants` |
| `apps/backend/src/modules/bookings/group-session-min-reached/group-session-min-reached.handler.ts` | Command uses `programId`; `groupSessionKey` uses `programId` |
| `apps/backend/src/modules/bookings/events/group-session-min-reached.event.ts` | Payload: `programId` instead of `serviceId` |
| `apps/backend/src/modules/bookings/bookings.module.ts` | Register new handlers |
| `apps/backend/src/api/dashboard/bookings.controller.ts` (group session section) | Wire `programId` in create endpoint |
| `apps/backend/openapi.json` | Regenerated via `pnpm openapi:sync` |
| `apps/dashboard/components/features/group-sessions/group-session-form-page.tsx` | Replace service selector with program selector |
| `apps/dashboard/lib/schemas/group-session.schema.ts` | `serviceId → programId` |
| `apps/dashboard/lib/api/group-sessions.ts` | Payload shape |
| `apps/dashboard/lib/types/group-session.ts` | Types |
| `apps/dashboard/hooks/use-group-sessions.ts` | No change needed (generic) |
| `apps/dashboard/lib/translations/ar.group-sessions.ts` | Update service→program labels |
| `apps/dashboard/lib/translations/en.group-sessions.ts` | Same |
| `apps/dashboard/lib/translations.ts` | Import new group-programs modules |
| `apps/mobile/services/client/group-sessions.ts` | Response type: `programId` instead of `serviceId` |
| `apps/backend/prisma/schema/bookings.prisma` (Phase 2) | Add `programId` to `Booking` (nullable) |

### Deferred (Phase 2 — after full verification)
| Path | Change |
|---|---|
| `apps/backend/prisma/schema/organization.prisma` | Remove `minParticipants`, `maxParticipants`, `reserveWithoutPayment` from `Service` |
| `apps/backend/prisma/migrations/<ts>_remove_service_group_fields/migration.sql` | Drop those columns |

---

## Task 1: Add `GroupProgram` model to Prisma schema + migration

**Files:**
- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Create: migration via `npx prisma migrate dev --name add_group_program`

**Interfaces:**
- Produces: `GroupProgram` model with fields used in Tasks 2–8

- [ ] **Step 1: Add `GroupProgram` model to `bookings.prisma`**

Open `apps/backend/prisma/schema/bookings.prisma`. After the last existing model, add:

```prisma
model GroupProgram {
  id            String   @id @default(uuid())
  ref           Int      @unique @default(autoincrement())
  departmentId  String
  nameAr        String
  nameEn        String?
  descriptionAr String?
  descriptionEn String?
  minParticipants Int    @default(1)
  maxParticipants Int    @default(30)
  defaultPrice  Int      @default(0)   // halalas
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions GroupSession[]

  @@index([departmentId])
  @@index([isActive])
}
```

- [ ] **Step 2: Update `GroupSession` — replace `serviceId` with `programId`**

In the same file, change the `GroupSession` model:

```prisma
// Remove this line:
  serviceId           String

// Add this line in its place:
  programId           String

// Add relation after the field:
  program             GroupProgram @relation(fields: [programId], references: [id])
```

Also add `@@index([programId])` in the index block.

- [ ] **Step 3: Add `programId` (nullable) to `Booking` model**

In `bookings.prisma`, inside the `Booking` model, add after `groupSessionId`:

```prisma
  programId           String?   // set for GROUP bookings only
```

- [ ] **Step 4: Run migration**

```bash
cd apps/backend
npx prisma migrate dev --name add_group_program
```

Expected: new migration file created under `prisma/migrations/`, Prisma client regenerated with `GroupProgram` type available.

- [ ] **Step 5: Verify Prisma client types**

```bash
cd apps/backend
npx tsc --noEmit 2>&1 | head -30
```

Expected: errors only about `serviceId` references in handlers (we fix those in Tasks 3–8), not about missing model types.

- [ ] **Step 6: Commit schema + migration**

```bash
git add apps/backend/prisma/
git commit -m "feat(db): add GroupProgram model, programId to GroupSession and Booking"
```

---

## Task 2: Backend CRUD for `GroupProgram` (create + list)

**Files:**
- Create: `apps/backend/src/modules/bookings/create-group-program/create-group-program.dto.ts`
- Create: `apps/backend/src/modules/bookings/create-group-program/create-group-program.handler.ts`
- Create: `apps/backend/src/modules/bookings/create-group-program/create-group-program.handler.spec.ts`
- Create: `apps/backend/src/modules/bookings/list-group-programs/list-group-programs.handler.ts`
- Create: `apps/backend/src/modules/bookings/list-group-programs/list-group-programs.handler.spec.ts`
- Create: `apps/backend/src/api/dashboard/group-programs.controller.ts`
- Modify: `apps/backend/src/modules/bookings/bookings.module.ts`

**Interfaces:**
- Produces: `POST /api/v1/dashboard/group-programs`, `GET /api/v1/dashboard/group-programs`
- Consumes: `GroupProgram` Prisma model (Task 1)

- [ ] **Step 1: Write the failing handler test**

Create `apps/backend/src/modules/bookings/create-group-program/create-group-program.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateGroupProgramHandler } from './create-group-program.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockPrisma = {
  department: { findFirst: jest.fn() },
  groupProgram: { create: jest.fn() },
};

describe('CreateGroupProgramHandler', () => {
  let handler: CreateGroupProgramHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateGroupProgramHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(CreateGroupProgramHandler);
    jest.clearAllMocks();
  });

  it('throws NotFoundException when department does not exist', async () => {
    mockPrisma.department.findFirst.mockResolvedValue(null);
    await expect(
      handler.execute({
        departmentId: 'd1',
        nameAr: 'برنامج',
        nameEn: 'Program',
        minParticipants: 3,
        maxParticipants: 15,
        defaultPrice: 0,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when department is inactive', async () => {
    mockPrisma.department.findFirst.mockResolvedValue({ id: 'd1', isActive: false });
    await expect(
      handler.execute({
        departmentId: 'd1',
        nameAr: 'برنامج',
        nameEn: 'Program',
        minParticipants: 3,
        maxParticipants: 15,
        defaultPrice: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates group program with valid input', async () => {
    mockPrisma.department.findFirst.mockResolvedValue({ id: 'd1', isActive: true });
    mockPrisma.groupProgram.create.mockResolvedValue({ id: 'gp1', ref: 1 });
    const result = await handler.execute({
      departmentId: 'd1',
      nameAr: 'برنامج دعم الأسرة',
      nameEn: 'Family Support Program',
      minParticipants: 3,
      maxParticipants: 15,
      defaultPrice: 5000,
    });
    expect(result).toEqual({ id: 'gp1', ref: 1 });
    expect(mockPrisma.groupProgram.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        departmentId: 'd1',
        nameAr: 'برنامج دعم الأسرة',
        minParticipants: 3,
        defaultPrice: 5000,
      }),
      select: { id: true, ref: true },
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
cd apps/backend
npx jest create-group-program.handler.spec.ts --no-coverage 2>&1 | tail -15
```

Expected: `Cannot find module './create-group-program.handler'`

- [ ] **Step 3: Create DTO**

Create `apps/backend/src/modules/bookings/create-group-program/create-group-program.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupProgramDto {
  @ApiProperty({ description: 'Department ID', example: '00000000-0000-0000-0000-000000000001' })
  @IsString() @IsNotEmpty()
  departmentId!: string;

  @ApiProperty({ description: 'Arabic name', example: 'برنامج دعم الأسرة' })
  @IsString() @IsNotEmpty()
  nameAr!: string;

  @ApiPropertyOptional({ description: 'English name', example: 'Family Support Program' })
  @IsOptional() @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ example: 'وصف البرنامج' })
  @IsOptional() @IsString()
  descriptionAr?: string;

  @ApiPropertyOptional({ example: 'Program description' })
  @IsOptional() @IsString()
  descriptionEn?: string;

  @ApiProperty({ description: 'Minimum participants to activate session', example: 3 })
  @IsInt() @Min(1)
  minParticipants!: number;

  @ApiProperty({ description: 'Maximum participants per session', example: 20 })
  @IsInt() @Min(1) @Max(500)
  maxParticipants!: number;

  @ApiProperty({ description: 'Default session price in halalas', example: 5000 })
  @IsInt() @Min(0)
  defaultPrice!: number;
}
```

- [ ] **Step 4: Create handler**

Create `apps/backend/src/modules/bookings/create-group-program/create-group-program.handler.ts`:

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateGroupProgramDto } from './create-group-program.dto';

export type CreateGroupProgramCommand = CreateGroupProgramDto;

@Injectable()
export class CreateGroupProgramHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateGroupProgramCommand) {
    const department = await this.prisma.department.findFirst({
      where: { id: cmd.departmentId },
      select: { id: true, isActive: true },
    });
    if (!department) throw new NotFoundException('Department not found');
    if (!department.isActive) throw new BadRequestException('Department is not active');

    return this.prisma.groupProgram.create({
      data: {
        departmentId: cmd.departmentId,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        descriptionAr: cmd.descriptionAr,
        descriptionEn: cmd.descriptionEn,
        minParticipants: cmd.minParticipants,
        maxParticipants: cmd.maxParticipants,
        defaultPrice: cmd.defaultPrice,
      },
      select: { id: true, ref: true },
    });
  }
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
cd apps/backend
npx jest create-group-program.handler.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 3 passed`

- [ ] **Step 6: Create list handler + test**

Create `apps/backend/src/modules/bookings/list-group-programs/list-group-programs.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ListGroupProgramsHandler } from './list-group-programs.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockPrisma = {
  groupProgram: { findMany: jest.fn() },
};

describe('ListGroupProgramsHandler', () => {
  let handler: ListGroupProgramsHandler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListGroupProgramsHandler,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    handler = module.get(ListGroupProgramsHandler);
    jest.clearAllMocks();
  });

  it('returns all active programs when activeOnly=true', async () => {
    mockPrisma.groupProgram.findMany.mockResolvedValue([
      { id: 'gp1', ref: 1, nameAr: 'برنامج', nameEn: null, departmentId: 'd1',
        minParticipants: 3, maxParticipants: 15, defaultPrice: 0, isActive: true },
    ]);
    const result = await handler.execute({ activeOnly: true });
    expect(result).toHaveLength(1);
    expect(mockPrisma.groupProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('returns all programs including inactive when activeOnly=false', async () => {
    mockPrisma.groupProgram.findMany.mockResolvedValue([]);
    await handler.execute({ activeOnly: false });
    expect(mockPrisma.groupProgram.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });
});
```

Create `apps/backend/src/modules/bookings/list-group-programs/list-group-programs.handler.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface ListGroupProgramsQuery {
  activeOnly?: boolean;
  departmentId?: string;
}

@Injectable()
export class ListGroupProgramsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListGroupProgramsQuery = {}) {
    const where: Record<string, unknown> = {};
    if (query.activeOnly) where['isActive'] = true;
    if (query.departmentId) where['departmentId'] = query.departmentId;

    return this.prisma.groupProgram.findMany({
      where,
      select: {
        id: true,
        ref: true,
        nameAr: true,
        nameEn: true,
        departmentId: true,
        minParticipants: true,
        maxParticipants: true,
        defaultPrice: true,
        isActive: true,
        descriptionAr: true,
        descriptionEn: true,
      },
      orderBy: { ref: 'asc' },
    });
  }
}
```

- [ ] **Step 7: Run list tests**

```bash
cd apps/backend
npx jest list-group-programs.handler.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: `Tests: 2 passed`

- [ ] **Step 8: Create dashboard controller**

Create `apps/backend/src/api/dashboard/group-programs.controller.ts`:

```typescript
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards';
import { CreateGroupProgramHandler } from '../../modules/bookings/create-group-program/create-group-program.handler';
import { ListGroupProgramsHandler } from '../../modules/bookings/list-group-programs/list-group-programs.handler';
import { CreateGroupProgramDto } from '../../modules/bookings/create-group-program/create-group-program.dto';

@ApiTags('Dashboard / Group Programs')
@UseGuards(JwtGuard)
@Controller('dashboard/group-programs')
export class GroupProgramsController {
  constructor(
    private readonly createHandler: CreateGroupProgramHandler,
    private readonly listHandler: ListGroupProgramsHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a group program' })
  create(@Body() dto: CreateGroupProgramDto) {
    return this.createHandler.execute(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List group programs' })
  list(
    @Query('activeOnly') activeOnly?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.listHandler.execute({
      activeOnly: activeOnly === 'true',
      departmentId,
    });
  }
}
```

- [ ] **Step 9: Register in bookings module**

In `apps/backend/src/modules/bookings/bookings.module.ts`, add to `providers` array:

```typescript
CreateGroupProgramHandler,
ListGroupProgramsHandler,
```

And add to `exports` array:

```typescript
CreateGroupProgramHandler,
ListGroupProgramsHandler,
```

In `apps/backend/src/app.module.ts` (or wherever controllers are registered), add `GroupProgramsController` to the controllers array. Alternatively, check how other dashboard controllers are registered — follow the same pattern.

- [ ] **Step 10: Typecheck**

```bash
cd apps/backend
npm run typecheck 2>&1 | grep -v "serviceId" | head -20
```

Expected: no errors except `serviceId`-related ones (fixed in Task 3).

- [ ] **Step 11: Run OpenAPI sync**

```bash
cd /Users/tariq/code/sawaa
pnpm openapi:sync
```

- [ ] **Step 12: Commit**

```bash
git add apps/backend/src/modules/bookings/create-group-program/ \
        apps/backend/src/modules/bookings/list-group-programs/ \
        apps/backend/src/api/dashboard/group-programs.controller.ts \
        apps/backend/src/modules/bookings/bookings.module.ts \
        apps/backend/openapi.json
git commit -m "feat(bookings): add GroupProgram CRUD handlers and dashboard controller"
```

---

## Task 3: Update `GroupSession` backend — swap `serviceId` → `programId`

**Files:**
- Modify: `apps/backend/src/modules/bookings/create-group-session/create-group-session.dto.ts`
- Modify: `apps/backend/src/modules/bookings/create-group-session/create-group-session.handler.ts`
- Modify: `apps/backend/src/modules/bookings/create-group-session/create-group-session.handler.spec.ts`
- Modify: `apps/backend/src/modules/bookings/get-group-session/get-group-session.handler.ts`
- Modify: `apps/backend/src/modules/bookings/list-group-sessions/list-group-sessions.handler.ts`

**Interfaces:**
- Consumes: `GroupProgram` model (Task 1), `ListGroupProgramsHandler` indirectly
- Produces: updated `CreateGroupSessionCommand` with `programId` instead of `serviceId`

- [ ] **Step 1: Update `create-group-session.dto.ts`**

Replace `serviceId` field with `programId`:

```typescript
// Remove:
@ApiProperty({ description: 'Service linked to this session', example: '00000000-...' })
@IsUUID()
serviceId!: string;

// Add:
@ApiProperty({ description: 'Group program this session belongs to', example: '00000000-...' })
@IsUUID()
programId!: string;
```

- [ ] **Step 2: Update `create-group-session.handler.ts`**

Replace the service validation block (steps 3–4 in the original) with program validation:

```typescript
// Remove steps 3 and 4 entirely (service check + employeeService check)
// Replace with:

// 3. Program check
const program = await this.prisma.groupProgram.findFirst({
  where: { id: cmd.programId },
  select: { id: true, nameAr: true, isActive: true },
});
if (!program) throw new NotFoundException('Group program not found');
if (!program.isActive) throw new BadRequestException('Group program is not active');
```

In `groupSession.create({ data: { ... } })`, replace `serviceId: cmd.serviceId` with `programId: cmd.programId`.

The full updated `execute()`:

```typescript
async execute(cmd: CreateGroupSessionCommand) {
  if (cmd.scheduledAt <= new Date()) {
    throw new BadRequestException('scheduledAt must be in the future');
  }

  const branch = await this.prisma.branch.findFirst({
    where: { id: cmd.branchId },
    select: { id: true, isActive: true },
  });
  if (!branch) throw new NotFoundException('Branch not found');
  if (!branch.isActive) throw new BadRequestException('Branch is not active');

  const employee = await this.prisma.employee.findFirst({
    where: { id: cmd.employeeId },
    select: { id: true, isActive: true },
  });
  if (!employee) throw new NotFoundException('Employee not found');
  if (!employee.isActive) throw new BadRequestException('Employee is not active');

  const program = await this.prisma.groupProgram.findFirst({
    where: { id: cmd.programId },
    select: { id: true, isActive: true },
  });
  if (!program) throw new NotFoundException('Group program not found');
  if (!program.isActive) throw new BadRequestException('Group program is not active');

  const session = await this.prisma.groupSession.create({
    data: {
      branchId: cmd.branchId,
      employeeId: cmd.employeeId,
      programId: cmd.programId,
      title: cmd.title,
      descriptionAr: cmd.descriptionAr,
      descriptionEn: cmd.descriptionEn,
      scheduledAt: cmd.scheduledAt,
      durationMins: cmd.durationMins,
      maxCapacity: cmd.maxCapacity,
      enrolledCount: 0,
      price: cmd.price,
      deliveryType: cmd.deliveryType,
      isPublic: cmd.isPublic ?? false,
      publicDescriptionAr: cmd.publicDescriptionAr,
      publicDescriptionEn: cmd.publicDescriptionEn,
    },
  });
  return { id: session.id, status: session.status, scheduledAt: session.scheduledAt };
}
```

Also update the `CreateGroupSessionCommand` type alias at the top: `Omit<CreateGroupSessionDto, 'scheduledAt'> & { scheduledAt: Date }` — no change needed there; the DTO now has `programId`.

- [ ] **Step 3: Update handler spec**

In `create-group-session.handler.spec.ts`, replace all mock setup and assertions that reference `serviceId` / `employeeService` / `service` with `programId` / `groupProgram`.

Key mock changes:
```typescript
// mockPrisma should have:
groupProgram: { findFirst: jest.fn() },
// Remove: service, employeeService

// In test for 'program not found':
mockPrisma.groupProgram.findFirst.mockResolvedValue(null);
// expect NotFoundException

// In test for 'inactive program':
mockPrisma.groupProgram.findFirst.mockResolvedValue({ id: 'gp1', isActive: false });
// expect BadRequestException

// In success case:
mockPrisma.groupProgram.findFirst.mockResolvedValue({ id: 'gp1', isActive: true });
// cmd should have programId: 'gp1' instead of serviceId
```

- [ ] **Step 4: Update `get-group-session.handler.ts`**

Replace the service resolution:
```typescript
// Remove:
const service = await this.prisma.service.findUnique({
  where: { id: session.serviceId },
  select: { nameAr: true, nameEn: true },
});

// Add:
const program = await this.prisma.groupProgram.findUnique({
  where: { id: session.programId },
  select: { id: true, nameAr: true, nameEn: true, departmentId: true, minParticipants: true },
});
```

In the response shape, replace `service: { nameAr, nameEn }` with `program: { id, nameAr, nameEn, departmentId, minParticipants }`.

- [ ] **Step 5: Update `list-group-sessions.handler.ts`**

In the `select` block, replace `serviceId` with `programId`. In the returned list items, replace `serviceId` with `programId`.

- [ ] **Step 6: Run all group-session handler tests**

```bash
cd apps/backend
npx jest create-group-session --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 7: Typecheck**

```bash
cd apps/backend
npm run typecheck 2>&1 | head -30
```

Expected: no errors from the modified files. Remaining errors should only be in capacity service and event files (fixed in Task 4).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/modules/bookings/create-group-session/ \
        apps/backend/src/modules/bookings/get-group-session/ \
        apps/backend/src/modules/bookings/list-group-sessions/
git commit -m "feat(bookings): replace serviceId with programId in GroupSession handlers"
```

---
## Task 4: Simplify capacity service — drop dead group-fill rollback, keep enrolledCount decrement

> **Context (discovered during execution):** The original plan assumed `group-session-capacity.service.ts` shares logic with the scheduled-GroupSession flow. Investigation proved otherwise: the scheduled flow (`book-group-session.handler.ts`) starts bookings in `AWAITING_PAYMENT`/`CONFIRMED` and **never** uses `PENDING_GROUP_FILL` or the min-reached machinery. The `PENDING_GROUP_FILL` rollback path here belongs ONLY to the dead capacity-based-group-service system (removed in Task 4b). However, `recalculateGroupStatus` IS still called from the live cancel/no-show/expire handlers (gated on `booking.groupSessionId`) to decrement `GroupSession.enrolledCount`. So we KEEP the method and its enrolledCount decrement, and STRIP the dead rollback body + the `serviceId` lookup.

**Files:**
- Modify: `apps/backend/src/modules/bookings/group-session/group-session-capacity.service.ts`
- Modify: `apps/backend/src/modules/bookings/group-session/group-session-capacity.service.spec.ts`

- [ ] **Step 1: Reduce `recalculateGroupStatus` to the enrolledCount decrement only**

The whole body after the guarded decrement (the `groupSession.findUnique({ select: { serviceId } })`, the `service.findUnique`, the `activeBookingCount` check, the rollback `updateMany`, and both `bookingStatusLog.create` loops) is dead once `PENDING_GROUP_FILL` is gone. Replace the method body so it ONLY performs the guarded decrement:

```typescript
  async recalculateGroupStatus(
    tx: Prisma.TransactionClient,
    groupSessionId: string,
  ): Promise<void> {
    // When a participant leaves a scheduled group session, decrement the
    // session's enrolled count (floored at 0). The fill-then-charge rollback
    // path was removed with the capacity-based group-service system; scheduled
    // sessions never enter PENDING_GROUP_FILL.
    await tx.groupSession.updateMany({
      where: { id: groupSessionId, enrolledCount: { gt: 0 } },
      data: { enrolledCount: { decrement: 1 } },
    });
  }
```

Remove the now-unused imports (`BookingStatus`, `PaymentStatus`) if nothing else in the file uses them; keep `Prisma`. Update the class doc comment to describe the decrement-only behavior. `recalculateGroupStatusStandalone` stays as-is (it just wraps `recalculateGroupStatus` in a transaction).

- [ ] **Step 2: Rewrite the spec**

`group-session-capacity.service.spec.ts` currently asserts rollback behavior (mocks `service.findUnique({ minParticipants })`, asserts `booking.updateMany` to PENDING_GROUP_FILL, asserts status logs). Replace those cases with decrement-only assertions:
- "decrements enrolledCount when > 0" → asserts `groupSession.updateMany` called with `where: { id, enrolledCount: { gt: 0 } }, data: { enrolledCount: { decrement: 1 } }`.
- "does not throw when session has no participants" → call completes.
- Remove every rollback/PENDING_GROUP_FILL/paid-deposit test case (those behaviors no longer exist).
Mock `tx` as `{ groupSession: { updateMany: jest.fn() } }`.

- [ ] **Step 3: Typecheck + test**

```bash
cd /Users/tariq/code/sawaa/apps/backend
npx jest group-session-capacity --no-coverage 2>&1 | tail -15
npx tsc --noEmit 2>&1 | grep "error TS" | head -30
```
Expected after this task: capacity-service errors gone. Remaining errors only in `public/*` (Task 5), `group-session-min-reached/*` + `events/group-session-min-reached.event.ts` + `create-booking` + `finance/group-session-ready` + `comms/on-group-session-payment-links-ready` (Task 4b deletes these), and the e2e spec (Task 9).

---

## Task 4b: Delete the dead capacity-based group-service system

> **This is a deletion task spanning bookings + finance + comms clusters. It removes the "individual booking of a `maxParticipants>1` service that accumulates until `minParticipants`, then charges" flow. Verified dead: no UI books it except a configuration form (removed in Task 6b), 0 live `PENDING_GROUP_FILL` bookings, and the scheduled-GroupSession flow does not touch it.**

**Files to DELETE entirely:**
- `apps/backend/src/modules/bookings/group-session-min-reached/group-session-min-reached.handler.ts`
- `apps/backend/src/modules/bookings/group-session-min-reached/group-session-min-reached.handler.spec.ts`
- `apps/backend/src/modules/bookings/events/group-session-min-reached.event.ts`
- `apps/backend/src/modules/bookings/events/group-session-min-reached.event.spec.ts` (if it exists)
- `apps/backend/src/modules/finance/group-session-ready/group-session-ready.handler.ts`
- `apps/backend/src/modules/finance/group-session-ready/group-session-ready.handler.spec.ts`
- `apps/backend/src/modules/comms/events/on-group-session-payment-links-ready.handler.ts`
- `apps/backend/src/modules/comms/events/on-group-session-payment-links-ready.handler.spec.ts` (if it exists)

**Files to MODIFY:**
- `apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts`
- `apps/backend/src/modules/bookings/create-booking/create-booking.handler.spec.ts`
- `apps/backend/src/modules/bookings/active-booking-statuses.ts`
- `apps/backend/src/modules/bookings/booking-state-machine.ts`
- `apps/backend/src/modules/bookings/booking-state-machine.spec.ts`
- `apps/backend/src/modules/bookings/bookings.module.ts` (drop `GroupSessionMinReachedHandler` import + provider)
- `apps/backend/src/modules/finance/finance.module.ts` (drop `GroupSessionReadyHandler` import, provider, onModuleInit `.register()`)
- `apps/backend/src/modules/comms/comms.module.ts` (drop `OnGroupSessionPaymentLinksReadyHandler` import, provider, onModuleInit `.register()`)
- Any spec referencing `PENDING_GROUP_FILL` as a blocking/capacity status (`booking-overlap-constraint.spec.ts`, `check-availability.handler.spec.ts`, `booking-row.mapper.spec.ts`, `__scenarios__/booking-scenarios.spec.ts`)

- [ ] **Step 1: Strip `create-booking.handler.ts` of the group-service path**

Read the file fully first. Remove:
- The `serviceRecord` fetch of `minParticipants/maxParticipants/reserveWithoutPayment` (lines ~256-259) and the `isGroupService`/`isReserveBeforePaymentGroup` derivations (lines ~263-265).
- The `!isGroupService` condition gating `needsOnlinePayment` (line ~278) — `needsOnlinePayment` becomes just `resolvedSource === 'ONLINE' && !dto.payAtClinic && price > 0`.
- The `initialStatus` ternary's `PENDING_GROUP_FILL` branch — `initialStatus` becomes `needsOnlinePayment ? 'AWAITING_PAYMENT' : 'CONFIRMED'`.
- The entire `else` branch of `if (!isGroupService) { ... } else { ... }` (the group advisory-lock + capacity-count + enrolledCount-increment block, lines ~317-339 and its continuation). After removal, the individual-booking lock/conflict block runs unconditionally (drop the `if (!isGroupService)` wrapper, keep its body).
- The `bookingType: isGroupService ? 'GROUP' : bookingType` (line ~413) → `bookingType`.
- The `&& !isGroupService` in the invoice-creation guard (line ~448) → `if (!dto.payAtClinic && price > 0)`.
- The entire post-transaction `if (isGroupService) { ...filledCount... groupMinReachedHandler.execute... }` block (lines ~507-525).
- The `groupMinReachedHandler` constructor injection (line ~52) and its import (line ~12).
- The `GROUP_CAPACITY_BOOKING_STATUSES` import if no longer used.

CAUTION: `dto.groupSessionId` handling — the scheduled GroupSession enrollment goes through `book-group-session.handler.ts`, NOT `create-booking`. Confirm via grep that `create-booking` is not the path used for scheduled enrollments (it is not — `book-group-session.handler.ts` creates those bookings directly). So removing the group branch here does not affect scheduled enrollment. If `create-booking` references `dto.groupSessionId` anywhere that remains reachable, leave the field write intact only if a non-group caller sets it; otherwise remove.

- [ ] **Step 2: Update `active-booking-statuses.ts`**

- Remove `BookingStatus.PENDING_GROUP_FILL` from `STAFF_TIME_BLOCKING_BOOKING_STATUSES`.
- Delete the entire `GROUP_CAPACITY_BOOKING_STATUSES` export.
- `grep -rn "GROUP_CAPACITY_BOOKING_STATUSES" apps/backend/src` — fix every remaining importer (after Step 1 there should be none in source; check specs).

- [ ] **Step 3: Update `booking-state-machine.ts`**

Remove the transitions tied only to the dead flow: `CREATE_GROUP_FILL`, `GROUP_FILL_REACHED_MIN`, `GROUP_FILL_ROLLBACK`. Remove `PENDING_GROUP_FILL` from the `EXPIRE.from[]` list. Leave all other transitions intact. Update `booking-state-machine.spec.ts` to drop the assertions for the removed transitions.

DECISION on the `PENDING_GROUP_FILL` enum value itself: do NOT remove the Prisma enum member in this task (it is a DB enum; dropping an enum value is a separate, riskier migration and 0 rows use it). Leave `BookingStatus.PENDING_GROUP_FILL` defined in the schema; just stop referencing it in code. (Optionally schedule enum removal as a later migration — out of scope here.)

- [ ] **Step 4: Delete the handler/event/consumer files + unwire modules**

Delete the 8 files listed above (those that exist). Then:
- `bookings.module.ts`: remove the `GroupSessionMinReachedHandler` import line and its entry in the providers array.
- `finance.module.ts`: remove the `GroupSessionReadyHandler` import, its provider entry, and the `.register()` call in `onModuleInit` (and remove the now-empty onModuleInit only if it has no other registrations).
- `comms.module.ts`: same for `OnGroupSessionPaymentLinksReadyHandler`.

- [ ] **Step 5: Sweep remaining references**

```bash
cd /Users/tariq/code/sawaa
grep -rn "PENDING_GROUP_FILL\|isGroupService\|reserveWithoutPayment\|GroupSessionMinReached\|group_session.min_reached\|group_session.payment_links_ready\|GroupSessionReadyHandler\|GROUP_CAPACITY" apps/backend/src --include="*.ts"
```
Expected: only the Prisma enum definition (schema) and possibly the `reserveWithoutPayment` Service column (removed in Task 10). Fix any straggler specs (replace group-fill scenarios with plain individual-booking assertions or delete the obsolete cases — do not leave skipped tests).

- [ ] **Step 6: Typecheck + full bookings/finance/comms tests**

```bash
cd /Users/tariq/code/sawaa/apps/backend
npx tsc --noEmit 2>&1 | grep "error TS" | head -40
npx jest create-booking booking-state-machine active-booking group-session-capacity --no-coverage 2>&1 | tail -25
```
Expected remaining tsc errors: ONLY `public/*` (Task 5) and the e2e spec (Task 9).

- [ ] **Step 7: Commit Tasks 4 + 4b together**

```bash
git add apps/backend/src/modules/bookings/ apps/backend/src/modules/finance/ apps/backend/src/modules/comms/
git commit -m "refactor(bookings): remove dead capacity-based group-service flow; simplify GroupSession capacity to enrolledCount decrement"
```

---

## Task 5: Update public booking flow (scheduled GroupSession) to programId

**Files:**
- Modify: `apps/backend/src/modules/bookings/public/book-group-session.handler.ts`
- Modify: `apps/backend/src/modules/bookings/public/list-public-group-sessions.handler.ts`
- Modify: `apps/backend/src/modules/bookings/public/get-public-group-session.handler.ts`
- Modify: the matching `*.spec.ts` for each, if present.

- [ ] **Step 1: `book-group-session.handler.ts`**

The `createBooking` session parameter type currently includes `serviceId: string`; change it to `programId: string`. The session is loaded from `groupSession` (which now has `programId`). In the `booking.create({ data })`, replace `serviceId: session.serviceId` with `programId: session.programId` and add `serviceId: null` (Booking.serviceId is nullable; GROUP bookings have no individual service). Verify the session-load select includes `programId`.

- [ ] **Step 2: `list-public-group-sessions.handler.ts`**

In the `findMany` select, remove `serviceId`; add a `program` relation select: `program: { select: { id: true, nameAr: true, nameEn: true, departmentId: true } }`. In the returned items, replace `serviceId` with `program`. Update the `PublicGroupSession` type accordingly. Add an optional `departmentId` filter to the query: `...(query.departmentId ? { program: { departmentId: query.departmentId } } : {})` — only if the DTO supports it; if adding the filter requires DTO changes, add `departmentId?: string` to the list DTO with `@ApiPropertyOptional` + `@IsOptional() @IsString()`.

- [ ] **Step 3: `get-public-group-session.handler.ts`**

Same pattern: include the `program` relation, remove `serviceId`, return `program` in the response. Update `PublicGroupSessionDetail` to replace `serviceId: string` with `program: { id: string; nameAr: string; nameEn: string | null; departmentId: string }`.

- [ ] **Step 4: Typecheck (expect backend clean except e2e)**

```bash
cd /Users/tariq/code/sawaa/apps/backend
npx tsc --noEmit 2>&1 | grep "error TS" | head -20
```
Expected: only `test/e2e/bookings/booking-scenarios.real-e2e-spec.ts` (Task 9) remains.

- [ ] **Step 5: OpenAPI sync (backend now boots clean)**

Restart any stale backend dev server first so the export reflects the new routes, then:
```bash
cd /Users/tariq/code/sawaa
pnpm openapi:sync 2>&1 | tail -15
git diff --stat apps/backend/openapi.json apps/dashboard/lib/types/api.generated.ts
```
Confirm `dashboard/group-programs` routes now appear and the group-session/public-group-session shapes show `program` instead of `serviceId`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/bookings/public/ apps/backend/openapi.json apps/dashboard/lib/types/api.generated.ts
git commit -m "feat(bookings): public scheduled group-session flow uses programId; Booking.serviceId=null for GROUP"
```

---

## Task 6: Dashboard — Group Programs CRUD page

(Unchanged from the original Task 6 — create translations, types, Zod schema, API funcs, TanStack hooks, form-page component, list page, create page, sidebar entry. Follow existing dashboard patterns; respect the 300-line component cap, CSS-token-only colors, HugeIcons, RTL logical classes, and run `pnpm i18n:verify`.)

Key contract from backend: `GET /dashboard/group-programs` returns `GroupProgram[]` with `{ id, ref, nameAr, nameEn, departmentId, minParticipants, maxParticipants, defaultPrice, isActive, descriptionAr, descriptionEn }`; `POST /dashboard/group-programs` takes `{ departmentId, nameAr, nameEn?, descriptionAr?, descriptionEn?, minParticipants, maxParticipants, defaultPrice }` (defaultPrice in halalas) and returns `{ id, ref }`.

The form converts `defaultPriceInSar` → halalas with `Math.round(value * 100)`. The department selector uses the existing `useDepartments()` hook.

- [ ] Build all files, typecheck (`npm run typecheck`), `pnpm i18n:verify`, commit.

---

## Task 6b: Remove the Service "group settings" UI (dead config)

> The dashboard Service create/edit form exposes `maxParticipants`, `minParticipants`, and `reserveWithoutPayment` — configuration for the now-deleted capacity-based group-service flow. Remove that UI so staff cannot configure a dead feature. This precedes the Phase-2 schema column drop (Task 10).

**Files:**
- Modify: `apps/dashboard/components/features/services/create/booking-settings-tab.tsx` (remove the `{(maxParticipants ?? 1) > 1 && (...)}` block AND the `maxParticipants` `OverrideField`)
- Modify: `apps/dashboard/components/features/services/create/form-schema.ts` (remove `minParticipants`, `maxParticipants`, `reserveWithoutPayment` from the Zod schema + defaults)
- Modify: `apps/dashboard/components/features/services/.../service-form-helpers.ts` (stop serializing those fields to the API payload)
- Modify: `apps/dashboard/components/features/services/.../service-form-page.tsx` (stop mapping them from service data)
- Modify: `apps/dashboard/lib/types/service.ts` and `service-payloads.ts` (remove the fields from TS types)
- Modify: `apps/dashboard/lib/translations/{ar,en}.services.ts` (remove the now-unused `services.booking.minParticipants.*`, `services.booking.maxParticipants.*`, `services.booking.reserveWithoutPayment.*` keys — both locales together to keep parity)

- [ ] **Steps:** Read each file, remove the fields/UI/keys, run `cd apps/dashboard && pnpm i18n:verify && npm run typecheck`, then commit:
```bash
git add apps/dashboard/
git commit -m "refactor(dashboard): remove dead Service group-capacity settings UI"
```

Note: the backend Service DTO still accepts these fields until Task 10 drops the columns; the dashboard simply stops sending them (they default in the DB). That is safe and intentional ordering.

---

## Task 7: Group Session dashboard form — swap service selector for program selector

(Unchanged from the original Task 7.) Replace `useServices()` with `useGroupPrograms()` in `group-session-form-page.tsx`; change the Zod schema + types + API payload from `serviceId` to `programId`; update the AR/EN `groupSessions.form.service*` keys to `groupSessions.form.program*`. The `get-group-session` response now returns `program` (not `service`) — update any detail view that read `session.service`. Run `pnpm i18n:verify`, `npm run typecheck`, commit.

---

## Task 8: Update mobile service types

(Unchanged.) In `apps/mobile/services/client/group-sessions.ts`, replace `serviceId: string` with `programId: string` and add an optional `program?: { id; nameAr; nameEn; departmentId }`. Run `pnpm --dir apps/mobile typecheck`, commit.

---

## Task 9: End-to-end verification + e2e spec fixes

- [ ] **Step 1: Fix the real-e2e spec** `test/e2e/bookings/booking-scenarios.real-e2e-spec.ts` (lines ~754/832/921 seed `GroupSession` with `serviceId`). Change those to seed a `GroupProgram` first and pass `programId`. Remove/rewrite any scenario that exercised the deleted capacity-based group-service flow.
- [ ] **Step 2: Backend full suite** `cd apps/backend && npm run test 2>&1 | tail -25` — all green.
- [ ] **Step 3: Backend e2e** `cd apps/backend && npm run test:e2e 2>&1 | tail -25` (needs `sawaa_e2e` DB; see memory `booking-state-machine-real-e2e`).
- [ ] **Step 4: Dashboard typecheck + i18n** `cd apps/dashboard && npm run typecheck && pnpm i18n:verify`.
- [ ] **Step 5: LIVE verification (Definition of Done — required).** Start the stack (`pnpm docker:up`, backend, dashboard). Then:
  1. Create a Group Program at `/group-programs/create` (department, AR name, min 3 / max 15, price 0) → success.
  2. Create a Group Session at `/group-sessions/create` → confirm the selector lists the program (not services) → success.
  3. As a test client, enroll in the session on the public site.
  4. In Prisma Studio confirm the GROUP `Booking` row has `serviceId = null` and `programId` set.
  5. Cancel one enrollment → confirm `GroupSession.enrolledCount` decremented (and NO PENDING_GROUP_FILL appears anywhere).
- [ ] **Step 6:** Commit the e2e spec fixes (the verification itself produces no code).

---

## Task 10 (Phase 2 — deferred): Remove group fields from `Service`

> Run only after Task 9 is fully verified. By now Task 4b removed all *code* references and Task 6b removed the UI, so the columns are unused.

- [ ] **Step 1:** `grep -rn "minParticipants\|maxParticipants\|reserveWithoutPayment" apps/backend/src --include="*.ts"` → expect 0 (sole exception: confirm `catalog.controller.ts` no longer selects `minParticipants`; remove if present).
- [ ] **Step 2:** Remove the three fields from the `Service` model in `apps/backend/prisma/schema/organization.prisma` (and the `minParticipants <= maxParticipants` CHECK-constraint comment/constraint if present).
- [ ] **Step 3:** `cd apps/backend && npx prisma migrate dev --name remove_service_group_fields` (note: the pre-existing pgvector/index drift means `migrate dev` may demand a reset — if so, generate via `prisma migrate diff` + hand-author the migration + `prisma migrate deploy`, exactly as Task 1 did; do NOT reset the dev DB).
- [ ] **Step 4:** Typecheck + test + `pnpm openapi:sync` + commit schema, migration, openapi.json together.

---

## Self-Review (revised)

| Requirement | Covered in |
|---|---|
| New `GroupProgram` model with `departmentId` | Task 1 ✅ done |
| `GroupSession.programId` replaces `serviceId` | Tasks 1, 3 ✅ done |
| `Booking.programId` for GROUP bookings | Tasks 1 ✅, 5 |
| Backend GroupProgram CRUD | Task 2 ✅ done |
| GroupSession admin handlers on programId | Task 3 ✅ done |
| Capacity service simplified (no dead rollback) | Task 4 |
| Dead capacity-based group-service flow removed | Task 4b |
| Public scheduled flow on programId | Task 5 |
| Dashboard Group Programs CRUD | Task 6 |
| Dead Service group-settings UI removed | Task 6b |
| Group Session form uses program selector | Task 7 |
| Mobile types | Task 8 |
| Full e2e + live verification | Task 9 |
| Remove Service group columns | Task 10 |

**Key correction vs. original plan:** Tasks 4/4b replace the original "convert min-reached + capacity to programId" — that was wrong, because the min-reached machinery serves a *separate, dead* capacity-based group-service flow (individual bookings of a `maxParticipants>1` service), not the scheduled GroupSession flow. We delete that flow instead of migrating it. `PENDING_GROUP_FILL` Prisma enum value is left defined (0 rows; enum-value drop deferred).
