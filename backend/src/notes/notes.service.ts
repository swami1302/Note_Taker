import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { BulkIdsDto } from './dto/bulk-ids.dto';

const EMPTY_DOC = [] as unknown as Prisma.InputJsonValue;

/** Notes older than this many days in the trash are auto-purged. */
const TRASH_RETENTION_DAYS = 30;

/** How often the purge job runs (ms). Default: once per hour. */
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class NotesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /** Start the periodic purge job on boot. */
  onModuleInit() {
    // Fire-and-forget: run once immediately, then every PURGE_INTERVAL_MS.
    void this.purgeExpired();
    setInterval(() => void this.purgeExpired(), PURGE_INTERVAL_MS);
  }

  // ─── Active notes ──────────────────────────────────────────────

  /** Landing-page list — lightweight, omits the note body. */
  findAll() {
    return this.prisma.note.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        locked: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
    });
    if (!note || note.deletedAt !== null) {
      throw new NotFoundException(`Note "${id}" was not found.`);
    }
    return note;
  }

  create(dto: CreateNoteDto) {
    return this.prisma.note.create({
      data: {
        title: dto.title?.trim() || 'Untitled',
        content: (dto.content ?? EMPTY_DOC) as Prisma.InputJsonValue,
        locked: dto.locked ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateNoteDto) {
    const note = await this.findOne(id);

    // Server-side enforcement: a locked note can never be edited again.
    if (note.locked) {
      throw new ConflictException('This note is locked and cannot be edited.');
    }

    return this.prisma.note.update({
      where: { id },
      data: this.buildUpdateData(dto),
    });
  }

  /** Save (optional) + permanently lock. */
  async lock(id: string, dto: UpdateNoteDto) {
    const note = await this.findOne(id);

    if (note.locked) {
      throw new ConflictException('This note is already locked.');
    }

    return this.prisma.note.update({
      where: { id },
      data: { ...this.buildUpdateData(dto), locked: true },
    });
  }

  // ─── Trash / soft-delete ───────────────────────────────────────

  /** List trashed notes (lightweight, same fields as findAll + deletedAt). */
  findTrash() {
    return this.prisma.note.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        title: true,
        locked: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
  }

  /** Soft-delete a single note (move to trash). */
  async softDelete(id: string) {
    const note = await this.findOne(id);
    return this.prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: new Date() },
    });
  }

  /** Soft-delete multiple notes at once. */
  async bulkSoftDelete(dto: BulkIdsDto) {
    const result = await this.prisma.note.updateMany({
      where: { id: { in: dto.ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { count: result.count };
  }

  /** Restore a single note from the trash. */
  async restore(id: string) {
    const note = await this.findTrashed(id);
    return this.prisma.note.update({
      where: { id: note.id },
      data: { deletedAt: null },
    });
  }

  /** Restore multiple notes from the trash at once. */
  async bulkRestore(dto: BulkIdsDto) {
    const result = await this.prisma.note.updateMany({
      where: { id: { in: dto.ids }, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    return { count: result.count };
  }

  /** Permanently delete a single trashed note. */
  async permanentDelete(id: string) {
    await this.findTrashed(id);
    await this.prisma.note.delete({ where: { id } });
    return { deleted: true };
  }

  /** Permanently delete all notes currently in the trash. */
  async emptyTrash() {
    const result = await this.prisma.note.deleteMany({
      where: { deletedAt: { not: null } },
    });
    return { count: result.count };
  }

  /** Auto-purge: permanently remove notes trashed > TRASH_RETENTION_DAYS ago. */
  async purgeExpired() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);

    const result = await this.prisma.note.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });

    if (result.count > 0) {
      // eslint-disable-next-line no-console
      console.log(`🗑️  Purged ${result.count} expired note(s) from trash.`);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /** Find a note that IS in the trash (deletedAt set). */
  private async findTrashed(id: string) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note || note.deletedAt === null) {
      throw new NotFoundException(
        `Note "${id}" was not found in the trash.`,
      );
    }
    return note;
  }

  private buildUpdateData(dto: UpdateNoteDto): Prisma.NoteUpdateInput {
    const data: Prisma.NoteUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim() || 'Untitled';
    }
    if (dto.content !== undefined) {
      data.content = dto.content as Prisma.InputJsonValue;
    }
    return data;
  }
}
