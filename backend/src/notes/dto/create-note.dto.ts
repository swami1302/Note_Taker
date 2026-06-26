import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  // BlockNote document: an array of block objects.
  @IsOptional()
  @IsArray()
  content?: unknown[];

  // Allows "Save & Lock" on a brand-new note in a single request.
  @IsOptional()
  @IsBoolean()
  locked?: boolean;
}
