import {
	IsBoolean,
	IsEnum,
	IsIn,
	IsNotEmpty,
	IsObject,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
	ValidateIf,
	registerDecorator,
	ValidationOptions,
} from 'class-validator';
import { isIP } from 'node:net';
import { DocumentStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto';

export const KNOWLEDGE_CONTENT_MAX_LENGTH = 50_000;
export type KnowledgeSourceType = 'manual' | 'url';

function isSafeKnowledgeUrl(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password) return false;
		const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
		if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return false;
		if (hostname === 'local' || hostname.endsWith('.local') || hostname === 'internal' || hostname.endsWith('.internal')) return false;
		if (isBlockedIp(hostname)) return false;
		return hostname.includes('.');
	} catch {
		return false;
	}
}

function isBlockedIpv4(hostname: string): boolean {
	const parts = hostname.split('.').map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
	const [a, b, c, d] = parts;
	return (
		a === 0 ||
		a === 10 ||
		(a === 100 && b >= 64 && b <= 127) ||
		a === 127 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 0 && c === 0) ||
		(a === 192 && b === 0 && c === 2) ||
		(a === 192 && b === 88 && c === 99 && d === 99) ||
		(a === 192 && b === 168) ||
		(a === 198 && b >= 18 && b <= 19) ||
		(a === 198 && b === 51 && c === 100) ||
		(a === 203 && b === 0 && c === 113) ||
		a >= 224
	);
}

function ipv6ToBigInt(hostname: string): bigint | undefined {
	const normalized = hostname.toLowerCase();
	const halves = normalized.split('::');
	if (halves.length > 2) return undefined;
	const left = halves[0] ? halves[0].split(':') : [];
	const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
	const expand = (part: string): string[] => {
		if (!part.includes('.')) return [part];
		const octets = part.split('.').map(Number);
		if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return [];
		return [(octets[0] * 256 + octets[1]).toString(16), (octets[2] * 256 + octets[3]).toString(16)];
	};
	const groups = [...left.flatMap(expand), ...right.flatMap(expand)];
	if (halves.length === 1 && groups.length !== 8) return undefined;
	if (halves.length === 2 && groups.length >= 8) return undefined;
	const full = halves.length === 2 ? [...left.flatMap(expand), ...Array(8 - groups.length).fill('0'), ...right.flatMap(expand)] : groups;
	if (full.length !== 8 || full.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return undefined;
	return full.reduce((value, group) => (value << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function hasIpv6Prefix(value: bigint, prefix: string, length: number): boolean {
	const base = ipv6ToBigInt(prefix);
	if (base === undefined) return false;
	const shift = BigInt(128 - length);
	return (value >> shift) === (base >> shift);
}

function isBlockedIp(hostname: string): boolean {
	const version = isIP(hostname);
	if (version === 4) return isBlockedIpv4(hostname);
	if (version !== 6) return false;
	const value = ipv6ToBigInt(hostname);
	if (value === undefined) return true;
	if ((value >> 32n) === 0xffffn) return isBlockedIpv4(`${Number((value >> 24n) & 255n)}.${Number((value >> 16n) & 255n)}.${Number((value >> 8n) & 255n)}.${Number(value & 255n)}`);
	return (
		hasIpv6Prefix(value, '::', 128) ||
		hasIpv6Prefix(value, '::1', 128) ||
		hasIpv6Prefix(value, 'fc00::', 7) ||
		hasIpv6Prefix(value, 'fe80::', 10) ||
		hasIpv6Prefix(value, 'ff00::', 8) ||
		hasIpv6Prefix(value, '2001:db8::', 32)
	);
}

function IsSafeKnowledgeContent(validationOptions?: ValidationOptions): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		registerDecorator({
			name: 'isSafeKnowledgeContent',
			target: target.constructor,
			propertyName: propertyKey.toString(),
			options: validationOptions,
			validator: {
				validate(value: unknown) {
					return typeof value === 'string' && !/<\/?[a-z][^>]*>/i.test(value);
				},
				defaultMessage() {
					return 'Knowledge content must be plain text without HTML or script markup';
				},
			},
		});
	};
}

function IsSafeKnowledgeUrl(validationOptions?: ValidationOptions): PropertyDecorator {
	return (target: object, propertyKey: string | symbol) => {
		registerDecorator({
			name: 'isSafeKnowledgeUrl',
			target: target.constructor,
			propertyName: propertyKey.toString(),
			options: validationOptions,
			validator: {
				validate(value: unknown) {
					return typeof value === 'string' && isSafeKnowledgeUrl(value);
				},
			},
		});
	};
}

export class ListDocumentsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by document status', enum: DocumentStatus, example: 'ACTIVE' })
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Document title', example: 'Clinic FAQ' })
  @IsOptional() @IsString() @MaxLength(500) title?: string;

  @ApiPropertyOptional({ description: 'Arbitrary JSON metadata', example: { source: 'admin' } })
	@IsOptional() @IsObject() metadata?: Record<string, unknown>;

	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(KNOWLEDGE_CONTENT_MAX_LENGTH)
	@IsSafeKnowledgeContent()
	@ApiPropertyOptional({ description: 'Plain-text document body', maxLength: KNOWLEDGE_CONTENT_MAX_LENGTH, nullable: true })
	content?: string;

	@IsOptional() @IsIn(['manual', 'url'])
	@ApiPropertyOptional({ enum: ['manual', 'url'], nullable: true })
	sourceType?: KnowledgeSourceType;

	@ValidateIf((o: UpdateDocumentDto) => o.sourceType === 'url' || o.sourceRef !== undefined)
	@IsString() @IsSafeKnowledgeUrl() @MaxLength(2_000)
	@ApiPropertyOptional({ description: 'HTTPS source URL', maxLength: 2_000, nullable: true })
	sourceRef?: string;

	@IsOptional() @IsBoolean()
	@ApiPropertyOptional({ description: 'Publication state; publication timestamps are server-owned', nullable: true })
	isPublished?: boolean;
}

export class CreateDocumentDto {
	@ApiProperty({ description: 'Document title', example: 'Clinic FAQ' })
	@IsString()
	@IsNotEmpty()
	@MaxLength(500)
	title!: string;

	@ApiPropertyOptional({ description: 'Arbitrary JSON metadata', example: { source: 'admin' } })
	@IsOptional()
	@IsObject()
	metadata?: Record<string, unknown>;

	// A manual entry must carry its body; URL entries carry a safe source URL.
	@ValidateIf((o: CreateDocumentDto) => o.sourceType === 'manual' || o.sourceType === undefined)
	@IsString()
	@IsNotEmpty()
	@MaxLength(KNOWLEDGE_CONTENT_MAX_LENGTH)
	@IsSafeKnowledgeContent()
	@ApiPropertyOptional({ description: 'Plain-text body for manual entries', maxLength: KNOWLEDGE_CONTENT_MAX_LENGTH, nullable: true })
	content?: string;

	@IsIn(['manual', 'url'])
	@ApiProperty({ enum: ['manual', 'url'], example: 'manual' })
	sourceType!: KnowledgeSourceType;

	@ValidateIf((o: CreateDocumentDto) => o.sourceType === 'url')
	@IsString()
	@IsSafeKnowledgeUrl()
	@MaxLength(2_000)
	@ApiPropertyOptional({ description: 'HTTPS source URL for URL entries', maxLength: 2_000, nullable: true })
	sourceRef?: string;

	@ApiPropertyOptional({ description: 'Draft state; publication timestamps are server-owned', example: false, default: false })
	@IsOptional()
	@IsBoolean()
	isPublished?: boolean;
}
