import {
  applyDecorators,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { MAX_IMAGE_BYTES } from './storage.service.js';

// Files are kept in memory (max 1 MB each) and validated before saving.
const limits = { fileSize: MAX_IMAGE_BYTES, files: 2 };

/** One image in the multipart field `image`. */
export function ImageUpload() {
  return applyDecorators(
    UseInterceptors(FileInterceptor('image', { limits })),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['image'],
        properties: { image: { type: 'string', format: 'binary' } },
      },
    }),
  );
}

/** A full-size `image` and a small `thumb`, both compressed by the app. */
export function ImageWithThumbUpload() {
  return applyDecorators(
    UseInterceptors(
      FileFieldsInterceptor(
        [
          { name: 'image', maxCount: 1 },
          { name: 'thumb', maxCount: 1 },
        ],
        { limits },
      ),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        required: ['image', 'thumb'],
        properties: {
          image: {
            type: 'string',
            format: 'binary',
            description: 'About 1280px, compressed by the app',
          },
          thumb: {
            type: 'string',
            format: 'binary',
            description: 'About 400px, used in lists',
          },
        },
      },
    }),
  );
}

export function requireFile(
  file: Express.Multer.File | undefined,
  field: string,
): Express.Multer.File {
  if (!file) throw new BadRequestException(`Missing file: ${field}`);
  return file;
}
