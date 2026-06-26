import { IsArray, IsString } from 'class-validator';

/** Payload for bulk soft-delete and bulk restore operations. */
export class BulkIdsDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
