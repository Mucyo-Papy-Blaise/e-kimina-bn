export const appConfig = () => ({
  app: {
    name: process.env.APP_NAME ?? 'nest-app',
    version: process.env.APP_VERSION ?? '0.0.1',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 12),
  },
  upload: {
    // Trim so trailing/linebreaks in .env do not break Cloudinary HMAC (Invalid Signature).
    cloudinaryCloudName: (process.env.CLOUDINARY_CLOUD_NAME ?? '').trim(),
    cloudinaryApiKey: (process.env.CLOUDINARY_API_KEY ?? '').trim(),
    cloudinaryApiSecret: (process.env.CLOUDINARY_API_SECRET ?? '').trim(),
    cloudinaryFolder: (process.env.CLOUDINARY_FOLDER ?? 'e-kimina').trim() || 'e-kimina',
  },
});
