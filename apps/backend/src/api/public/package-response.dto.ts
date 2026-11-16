import { ApiProperty } from '@nestjs/swagger';
import {
  PackageDetailResponseDto,
  PackageFamilyWithVatResponseDto,
} from '../dashboard/dto/package-response.dto';

/**
 * Swagger response shapes for the PUBLIC package routes.
 *
 * The public handlers reuse the exact same decorators as the dashboard
 * (`decorateFamily`, `decorateFamilyOption`, `decorateGroupedPackage`,
 * `ComputePackagePriceService`), so the payload is structurally identical to
 * the dashboard read rows. These subclasses exist to give the public surface
 * its own prefixed schema names (`PublicPackage…`) rather than to restate a
 * second, drifting copy of 600 lines of field documentation. The dashboard
 * spec already pins those base classes to the handlers' inferred output.
 *
 * PUBLIC FILTERING IS UNCHANGED: only public + active + non-archived rows are
 * selected by the handlers; nothing here widens or loosens that query.
 *
 * Prices stay NET here; `vatRate` is the fraction the purchase invoice adds.
 */

/** `GET /public/package-families` and `GET /public/package-families/:familyId`. */
export class PublicPackageFamilyWithVatResponseDto extends PackageFamilyWithVatResponseDto {}

/**
 * `GET /public/packages` and `GET /public/packages/:packageId`: the decorated
 * read row plus the sale VAT rate.
 */
export class PublicPackageResponseDto extends PackageDetailResponseDto {
  @ApiProperty({ description: 'VAT rate the purchase invoice adds on top of the net price (fraction; 0 unless enabled)', example: 0 })
  declare vatRate: number;
}
