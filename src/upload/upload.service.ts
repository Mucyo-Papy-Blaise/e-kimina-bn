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
              const message =
                error instanceof Error
                  ? error.message
                  : typeof error === 'string'
                    ? error
                    : 'Cloudinary upload failed.';

              reject(new BadRequestException(message));
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
