import type { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client as MinioClient } from 'minio';
import { DEMO_ASSET_DIR, demoClinics, demoGroupAssets, demoPackages, demoPrograms, demoServices, demoTherapists } from './enriched-catalog-content';

/** Opt-in additive catalog enrichment, separate from legacy demo bookings. */
export async function enrichExistingCatalog(prisma: PrismaClient): Promise<void> {
  const endpoint = process.env.MINIO_ENDPOINT;
  const bucket = process.env.MINIO_BUCKET;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const client = endpoint && bucket && accessKey && secretKey
    ? new MinioClient({ endPoint: endpoint, port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true', accessKey, secretKey })
    : null;

  async function imageKey(asset: string, ownerType: string, ownerId: string): Promise<string | undefined> {
    if (!client || !bucket) return undefined;
    try {
      const buffer = await readFile(join(DEMO_ASSET_DIR, asset));
      // Same artwork -> same key; changed bytes -> new key, without replacing another owner's file.
      const key = `demo-catalog/${createHash('sha256').update(asset).update(buffer).digest('hex')}.png`;
      const exists = await prisma.file.findUnique({ where: { storageKey: key } });
      if (!exists) {
        await client.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': 'image/png' });
        await prisma.file.create({ data: { bucket, storageKey: key, filename: asset.split('/').at(-1)!,
          mimetype: 'image/png', size: buffer.length, visibility: 'PUBLIC', ownerType, ownerId } });
      } else if (exists.bucket !== bucket || exists.isDeleted || exists.ownerType !== ownerType || exists.ownerId !== ownerId || exists.visibility !== 'PUBLIC') {
        console.warn(`Skipping demo image ${asset}: conflicting file metadata`);
        return undefined;
      } else {
        // A metadata row alone does not guarantee that the object still exists.
        await client.statObject(bucket, key);
      }
      return key;
    } catch (error) {
      console.warn(`Demo image unavailable (${asset}); preserving current image: ${String(error)}`);
      return undefined;
    }
  }

  // Employee.publicImageUrl must be an absolute URL here (see
  // media/owned-image.resolver.ts): a bare key is only signed when it matches a
  // File row owned by that employee, otherwise the public employees handler
  // drops it. For this local demo we serve the object straight
  // from MinIO with an anonymous-download bucket policy.
  // Match MinioService's existing public signing endpoint contract: public
  // settings are independent of the internal upload host and TLS setting.
  const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT;
  const publicUseSSL = (publicEndpoint ? process.env.MINIO_PUBLIC_USE_SSL : process.env.MINIO_USE_SSL) === 'true';
  const publicPort = Number(publicEndpoint
    ? process.env.MINIO_PUBLIC_PORT ?? (publicUseSSL ? 443 : 80)
    : process.env.MINIO_PORT || 9000);
  const defaultPort = publicUseSSL ? 443 : 80;
  const publicOrigin = `${publicUseSSL ? 'https' : 'http'}://${publicEndpoint || endpoint}${publicPort === defaultPort ? '' : `:${publicPort}`}`;
  const publicObjectUrl = (key: string) => `${publicOrigin}/${bucket}/${key}`;
  if (client && bucket) {
    try {
      // Read before writing: preserve every existing statement and policy field.
      // An unreadable policy is not an empty policy; fail closed on read errors.
      let rawPolicy: string;
      try {
        rawPolicy = await client.getBucketPolicy(bucket);
      } catch (error) {
        if ((error as { code?: string }).code !== 'NoSuchBucketPolicy') throw error;
        rawPolicy = '';
      }
      const existing = rawPolicy ? JSON.parse(rawPolicy) : { Version: '2012-10-17', Statement: [] };
      if (!existing || !Array.isArray(existing.Statement)) throw new Error('Invalid existing bucket policy');
      const demoRead = {
        Effect: 'Allow',
        Principal: { AWS: ['*'] },
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/demo-catalog/*`],
      };
      const alreadyPresent = existing.Statement.some(
        (statement: unknown) => JSON.stringify(statement) === JSON.stringify(demoRead),
      );
      const policy = JSON.stringify({
        ...existing,
        Statement: alreadyPresent ? existing.Statement : [...existing.Statement, demoRead],
      });
      await client.setBucketPolicy(bucket, policy);
    } catch (error) {
      console.warn(`Could not set demo bucket policy: ${String(error)}`);
    }
  }

  for (const clinic of demoClinics) {
    const category = await prisma.serviceCategory.findFirst({ where: { nameAr: clinic.nameAr } });
    if (!category || category.kind !== 'CLINIC') continue;
    const key = await imageKey(clinic.asset, 'ServiceCategory', category.id);
    await prisma.serviceCategory.update({ where: { id: category.id },
      data: { iconName: clinic.iconName, ...(key ? { imageUrl: key } : {}) } });
    // Category has no description column: DIRECT uses its sole internal service;
    // SERVICES fills its first public service only when no service in the
    // category carries a description yet (never overwrites authored copy).
    if (category.bookingMode === 'DIRECT') {
      const service = await prisma.service.findFirst({ where: { categoryId: category.id, isHidden: true } });
      if (service && (!service.descriptionAr || !service.descriptionEn)) {
        await prisma.service.update({ where: { id: service.id }, data: {
          ...(service.descriptionAr ? {} : { descriptionAr: clinic.descriptionAr }),
          ...(service.descriptionEn ? {} : { descriptionEn: clinic.descriptionEn }),
        } });
      }
    } else {
      const services = await prisma.service.findMany({
        where: { categoryId: category.id, isHidden: false, isActive: true },
        orderBy: { nameAr: 'asc' },
      });
      if (services.length && !services.some((s) => s.descriptionAr)) {
        await prisma.service.update({ where: { id: services[0].id },
          data: { descriptionAr: clinic.descriptionAr } });
      }
    }
  }
  for (const therapist of demoTherapists) {
    const employee = await prisma.employee.findFirst({ where: { slug: therapist.slug, isPublic: true } });
    if (!employee) continue;
    const key = await imageKey(therapist.asset, 'Employee', employee.id);
    await prisma.employee.update({ where: { id: employee.id }, data: {
      ...(employee.publicBioAr ? {} : { publicBioAr: therapist.bioAr }),
      ...(employee.publicBioEn ? {} : { publicBioEn: therapist.bioEn }),
      ...(key ? { publicImageUrl: publicObjectUrl(key) } : {}) } });
  }
  for (const family of demoPackages) {
    const existing = await prisma.packageFamily.findFirst({ where: { nameAr: family.nameAr } });
    if (existing) {
      const key = await imageKey(family.asset, 'PackageFamily', existing.id);
      await prisma.packageFamily.update({ where: { id: existing.id }, data: {
        ...(existing.descriptionAr ? {} : { descriptionAr: family.descriptionAr }),
        ...(existing.descriptionEn ? {} : { descriptionEn: family.descriptionEn }),
        ...(key ? { imageUrl: key } : {}) } });
      continue;
    }
    // Standalone packages (familyId null) surface on /public/package-families
    // as their own rows; enrich them by name the same way.
    const standalone = await prisma.sessionPackage.findFirst({ where: { nameAr: family.nameAr } });
    if (!standalone) continue; // Never create empty, unbookable packages as visual props.
    const key = await imageKey(family.asset, 'SessionPackage', standalone.id);
    await prisma.sessionPackage.update({ where: { id: standalone.id }, data: {
      ...(standalone.descriptionAr ? {} : { descriptionAr: family.descriptionAr }),
      ...(standalone.descriptionEn ? {} : { descriptionEn: family.descriptionEn }),
      ...(key ? { imageUrl: key } : {}) } });
  }
  // English copy for individual services that carry none yet (never overwrites).
  for (const entry of demoServices) {
    const service = await prisma.service.findFirst({ where: { nameAr: entry.nameAr } });
    if (!service || service.descriptionEn) continue;
    await prisma.service.update({ where: { id: service.id }, data: { descriptionEn: entry.descriptionEn } });
  }
  // Program rows have no image column; fill missing English public copy only.
  for (const entry of demoPrograms) {
    const program = await prisma.program.findFirst({ where: { nameAr: entry.nameAr } });
    if (!program || program.publicDescriptionEn) continue;
    await prisma.program.update({ where: { id: program.id }, data: { publicDescriptionEn: entry.publicDescriptionEn } });
  }
  for (const program of demoGroupAssets) {
    const service = await prisma.service.findFirst({ where: { nameAr: `جلسة جماعية — ${program.serviceNameAr}` } });
    if (!service) continue;
    const key = await imageKey(program.asset, 'Service', service.id);
    if (key) await prisma.service.update({ where: { id: service.id }, data: { imageUrl: key } });
  }
  console.log('✔ Existing demo catalog enriched (without creating finance or booking rows)');
}
