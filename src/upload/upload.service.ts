import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  UploadApiOptions,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
import { appConfig } from '../config/app.config';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from './upload.constants';

type AppConfig = ReturnType<typeof appConfig>;

function messageFromCloudinaryError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object') {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message.trim()) {
      return o.message;
    }
    if (o.error && typeof o.error === 'object') {
      const e = o.error as Record<string, unknown>;
      if (typeof e.message === 'string' && e.message.trim()) {
        return e.message;
      }
    }
    if (typeof o.http_code === 'number') {
      return `Cloudinary error (HTTP ${o.http_code})`;
    }
    try {
      const s = JSON.stringify(error);
      if (s && s !== '{}') {
        return s.length > 300 ? `${s.slice(0, 300)}…` : s;
      }
    } catch {
      // ignore
    }
  }
  return 'Cloudinary upload failed (see server logs for details).';
}

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format: string;
  bytes: number;
}

@Injectable()
export class UploadService {
  private readonly uploadFolder: string;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const cloudName = this.configService.get('upload.cloudinaryCloudName', {
      infer: true,
    });
    const apiKey = this.configService.get('upload.cloudinaryApiKey', {
      infer: true,
    });
    const apiSecret = this.configService.get('upload.cloudinaryApiSecret', {
      infer: true,
    });

    this.uploadFolder = this.configService.get('upload.cloudinaryFolder', {
      infer: true,
    });
    this.isConfigured = !!cloudName && !!apiKey && !!apiSecret;

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided.');
    }

    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed.`,
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('File size exceeds the 10MB limit.');
    }

    if (!file.buffer?.length) {
      throw new BadRequestException('File buffer is missing.');
    }

    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Upload service is not configured. Set Cloudinary environment variables first.',
      );
    }

    const uploadOptions: UploadApiOptions = {
      resource_type: 'auto',
      folder: this.uploadFolder,
    };

    try {
      return await new Promise<UploadResult>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error: unknown, result: UploadApiResponse | undefined) => {
            if (error) {
              reject(
                new BadRequestException(messageFromCloudinaryError(error)),
              );
              return;
            }

            if (!result) {
              reject(
                new BadRequestException(
                  'Cloudinary returned no upload result.',
                ),
              );
              return;
            }

            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            });
          },
        );

        uploadStream.end(file.buffer);
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Upload failed unexpectedly.');
    }
  }
}
