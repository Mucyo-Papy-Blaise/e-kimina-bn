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
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER ?? 'e-kimina',
  },
});
