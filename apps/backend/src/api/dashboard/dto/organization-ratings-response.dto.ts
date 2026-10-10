import { ApiProperty } from '@nestjs/swagger';

export class RatingClientResponseDto {
  @ApiProperty({ format: 'uuid', description: "Identifier of the person associated with the rating", example: "22222222-2222-4222-8222-222222222222" }) id!: string;
  @ApiProperty({ description: "Display name of the person associated with the rating", example: "عميل تجريبي" }) name!: string;
}
export class RatingEmployeeResponseDto extends RatingClientResponseDto {
  @ApiProperty({ type: String, nullable: true, description: "English employee display name, or null when unavailable", example: "Example Counselor" }) nameEn!: string | null;
}
export class OrganizationRatingResponseDto {
  @ApiProperty({ format: 'uuid', description: "Unique rating identifier", example: "55555555-5555-4555-8555-555555555555" }) id!: string;
  @ApiProperty({ format: 'uuid', description: "Booking that the client rated", example: "44444444-4444-4444-8444-444444444444" }) bookingId!: string;
  @ApiProperty({ format: 'uuid', description: "Identifier of the client who submitted the rating", example: "22222222-2222-4222-8222-222222222222" }) clientId!: string;
  @ApiProperty({ format: 'uuid', description: "Identifier of the employee being rated", example: "33333333-3333-4333-8333-333333333333" }) employeeId!: string;
  @ApiProperty({ minimum: 1, maximum: 5, description: "Rating score from one to five stars", example: 5 }) score!: number;
  @ApiProperty({ type: String, nullable: true, description: "Client feedback text, or null when no comment was submitted", example: "Helpful session" }) comment!: string | null;
  @ApiProperty({ description: "Whether the rating is approved for public display", example: false }) isPublic!: boolean;
  @ApiProperty({ type: String, format: 'date-time', description: "Rating submission time as an ISO 8601 UTC timestamp", example: "2026-10-10T09:00:00.000Z" }) createdAt!: Date;
  @ApiProperty({ type: RatingClientResponseDto, nullable: true, description: "Current client display details, or null when unavailable", example: {"id": "22222222-2222-4222-8222-222222222222", "name": "عميل تجريبي"} }) client!: RatingClientResponseDto | null;
  @ApiProperty({ type: RatingEmployeeResponseDto, nullable: true, description: "Current employee display details, or null when unavailable", example: {"id": "33333333-3333-4333-8333-333333333333", "name": "أخصائي تجريبي", "nameEn": "Example Counselor"} }) employee!: RatingEmployeeResponseDto | null;
}
export class OrganizationRatingsMetaDto {
  @ApiProperty({ description: "Total number of matching ratings", example: 1 }) total!: number;
  @ApiProperty({ description: "Current page number, starting at one", example: 1 }) page!: number;
  @ApiProperty({ description: "Maximum number of items returned per page", example: 20 }) limit!: number;
  @ApiProperty({ description: "Total number of pages for the matching result set", example: 1 }) totalPages!: number;
  @ApiProperty({ description: "Whether another page follows the current page", example: false }) hasNextPage!: boolean;
  @ApiProperty({ description: "Whether a page precedes the current page", example: false }) hasPreviousPage!: boolean;
}
export class OrganizationRatingsResponseDto {
  @ApiProperty({ type: [OrganizationRatingResponseDto], description: "Ratings on the requested page", example: [{"id": "55555555-5555-4555-8555-555555555555", "bookingId": "44444444-4444-4444-8444-444444444444", "clientId": "22222222-2222-4222-8222-222222222222", "employeeId": "33333333-3333-4333-8333-333333333333", "score": 5, "comment": "Helpful session", "isPublic": false, "createdAt": "2026-10-10T09:00:00.000Z", "client": {"id": "22222222-2222-4222-8222-222222222222", "name": "عميل تجريبي"}, "employee": {"id": "33333333-3333-4333-8333-333333333333", "name": "أخصائي تجريبي", "nameEn": "Example Counselor"}}] }) items!: OrganizationRatingResponseDto[];
  @ApiProperty({ type: OrganizationRatingsMetaDto, description: "Pagination metadata for all matching ratings", example: {"total": 1, "page": 1, "limit": 20, "totalPages": 1, "hasNextPage": false, "hasPreviousPage": false} }) meta!: OrganizationRatingsMetaDto;
  @ApiProperty({ type: Number, nullable: true, minimum: 1, maximum: 5, description: 'Average score across all matching ratings, independent of pagination; null when empty', example: 5 }) averageRating!: number | null;
}
