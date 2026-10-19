import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  /** @example 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  /** @example 20 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}

export class PageMetaDto {
  page: number;
  pageSize: number;
  total: number;
}

/** Prisma skip/take for a page. */
export function pageArgs({ page, pageSize }: PaginationQueryDto) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageMeta(
  { page, pageSize }: PaginationQueryDto,
  total: number,
): PageMetaDto {
  return { page, pageSize, total };
}
