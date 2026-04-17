import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from './upload.constants';
import { UploadResponseDto } from './dto/upload-response.dto';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth('JWT-auth')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_UPLOAD_SIZE_BYTES,
      },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype as never)) {
          callback(
            new BadRequestException(
              `File type ${file.mimetype} is not allowed.`,
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a document or image to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Accepted file types: JPG, PNG, GIF, WEBP, SVG, PDF, DOC, DOCX. Max size: 10MB.',
        },
      },
    },
  })
  @ApiOkResponse({ type: UploadResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid file type, missing file, or file too large.',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A file is required.');
    }

    return this.uploadService.uploadFile(file);
  }
}
