import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v1234567890/e-kimina/avatar.jpg',
  })
  url!: string;

  @ApiProperty({ example: 'e-kimina/avatar' })
  publicId!: string;

  @ApiProperty({ example: 1200, required: false, nullable: true })
  width?: number;

  @ApiProperty({ example: 800, required: false, nullable: true })
  height?: number;

  @ApiProperty({ example: 'jpg' })
  format!: string;

  @ApiProperty({ example: 124533 })
  bytes!: number;
}
