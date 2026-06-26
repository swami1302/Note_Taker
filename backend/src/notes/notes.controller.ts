import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';
import { NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  // ─── Static routes MUST come before parameterised :id routes ───

  @Get()
  findAll() {
    return this.notes.findAll();
  }

  @Get('trash')
  findTrash() {
    return this.notes.findTrash();
  }

  @Post()
  create(@Body() dto: CreateNoteDto) {
    return this.notes.create(dto);
  }

  @Post('bulk-delete')
  bulkSoftDelete(@Body() dto: BulkIdsDto) {
    return this.notes.bulkSoftDelete(dto);
  }

  @Post('bulk-restore')
  bulkRestore(@Body() dto: BulkIdsDto) {
    return this.notes.bulkRestore(dto);
  }

  @Delete('trash/empty')
  emptyTrash() {
    return this.notes.emptyTrash();
  }

  // ─── Parameterised :id routes ──────────────────────────────────

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notes.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.update(id, dto);
  }

  @Post(':id/lock')
  lock(@Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.notes.lock(id, dto);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string) {
    return this.notes.softDelete(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.notes.restore(id);
  }

  @Delete(':id/permanent')
  permanentDelete(@Param('id') id: string) {
    return this.notes.permanentDelete(id);
  }
}
