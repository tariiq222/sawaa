import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { OnboardEmployeeDto } from './onboard-employee.dto';

export type OnboardEmployeeCommand = OnboardEmployeeDto;

@Injectable()
export class OnboardEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(dto: OnboardEmployeeCommand) {
    let employee;
    try {
      employee = await this.rlsTransaction.withTransaction((tx) =>
        tx.employee.create({
          data: {
            name: dto.nameAr || dto.nameEn,
            nameEn: dto.nameEn,
            nameAr: dto.nameAr,
            title: dto.title,
            specialty: dto.specialty,
            specialtyAr: dto.specialtyAr,
            email: dto.email,
            phone: dto.phone,
            gender: dto.gender,
            employmentType: dto.employmentType ?? 'FULL_TIME',
            bio: dto.bio,
            bioAr: dto.bioAr,
            education: dto.education,
            educationAr: dto.educationAr,
            experience: dto.experience,
            avatarUrl: dto.avatarUrl ?? undefined,
            isActive: dto.isActive ?? true,
            isPublic: dto.isPublic ?? false,
          },
          include: { branches: true, services: true },
        }),
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already registered for this employee');
      }
      throw err;
    }

    return {
      success: true,
      message: 'Employee onboarded successfully',
      employee,
    };
  }
}
