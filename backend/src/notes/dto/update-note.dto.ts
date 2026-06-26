import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

// Used for both PATCH /notes/:id (save) and POST /notes/:id/lock (save & lock).
// `locked` is intentionally NOT editable here — locking happens via the lock endpoint.
export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsArray()
  content?: unknown[];
}
