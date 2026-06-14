import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

// Finance buckets are referenced by string literal in the finance handlers
// (bank-transfer-upload.handler.ts, issue-invoice-receipt.handler.ts). Keep
// these names as the single source of truth so onModuleInit provisions them.
export const FINANCE_RECEIPTS_BUCKET = 'finance-receipts';
export const FINANCE_INVOICES_BUCKET = 'finance-invoices';

interface IStorageService {
  uploadFile(bucket: string, key: string, buffer: Buffer, mimetype: string): Promise<string>;
  deleteFile(bucket: string, key: string): Promise<void>;
  getSignedUrl(bucket: string, key: string, expiry?: number): Promise<string>;
  fileExists(bucket: string, key: string): Promise<boolean>;
}

@Injectable()
export class MinioService implements IStorageService, OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Client;
  // Signs presigned URLs. Presigned links are handed to browsers, which cannot
  // resolve the internal Docker-network hostname the in-cluster client uses, so
  // when MINIO_PUBLIC_ENDPOINT is set we sign against the public host instead.
  // The signature embeds the host, so it cannot be swapped after signing.
  private readonly signClient: Client;
  private readonly defaultBucket: string;
  private readonly publicEndpoint: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.getOrThrow<string>('MINIO_ENDPOINT');
    const port = this.config.getOrThrow<number>('MINIO_PORT');
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';
    const accessKey = this.config.getOrThrow<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.getOrThrow<string>('MINIO_SECRET_KEY');

    this.client = new Client({ endPoint: endpoint, port: Number(port), useSSL, accessKey, secretKey });

    const publicEndpoint = this.config.get<string>('MINIO_PUBLIC_ENDPOINT');
    if (publicEndpoint) {
      const publicUseSSL = this.config.get<string>('MINIO_PUBLIC_USE_SSL') === 'true';
      const publicPort = Number(this.config.get<number>('MINIO_PUBLIC_PORT') ?? (publicUseSSL ? 443 : 80));
      this.signClient = new Client({ endPoint: publicEndpoint, port: publicPort, useSSL: publicUseSSL, accessKey, secretKey });
    } else {
      this.signClient = this.client;
    }

    this.defaultBucket = this.config.getOrThrow<string>('MINIO_BUCKET');
    const scheme = useSSL ? 'https' : 'http';
    this.publicEndpoint = `${scheme}://${endpoint}:${port}`;
  }

  async onModuleInit(): Promise<void> {
    try {
      const requiredBuckets = [
        this.defaultBucket,
        FINANCE_RECEIPTS_BUCKET,
        FINANCE_INVOICES_BUCKET,
      ];
      for (const bucket of requiredBuckets) {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket);
          this.logger.log(`Bucket "${bucket}" created`);
        }
      }
      this.logger.log('MinIO connected');
    } catch (err) {
      // Dev convenience: allow the server to boot without MinIO for UI-only workflows.
      // File upload endpoints will still fail at call time if MinIO is unreachable.
      this.logger.warn(`MinIO unavailable — file storage disabled: ${(err as Error).message}`);
    }
  }

  async uploadFile(bucket: string, key: string, buffer: Buffer, mimetype: string): Promise<string> {
    await this.client.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': mimetype });
    return `${this.publicEndpoint}/${bucket}/${key}`;
  }

  async deleteFile(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }

  async getSignedUrl(bucket: string, key: string, expiry = 3600): Promise<string> {
    return this.signClient.presignedGetObject(bucket, key, expiry);
  }

  async fileExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.statObject(bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async bucketExists(bucket: string): Promise<boolean> {
    return this.client.bucketExists(bucket);
  }

  async ping(): Promise<void> {
    await this.client.listBuckets();
  }
}
