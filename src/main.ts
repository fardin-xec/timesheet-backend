import { webcrypto } from 'crypto';

// IMPORTANT: This must be before any other imports
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto;
}
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TypeORMError } from 'typeorm/error/TypeORMError';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as express from 'express';


async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);

     app.use(express.json({ limit: '50mb' }));
     app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Get the configuration service to access environment variables
  const configService = app.get(ConfigService);

  // Set the port from the environment variable
  const port = configService.get<number>('PORT');



  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  const payslipsPath = join(__dirname, '..', 'payslips')
  app.useStaticAssets(payslipsPath, {
  prefix: '/payslips/',
  setHeaders: (res, path, stat) => {
    res.set('Access-Control-Allow-Origin', 'http://localhost:3001'); // Specific origin, not '*'
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
  },
})
  
  

  // Enable CORS if needed
  app.enableCors();

  // Apply the global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  try {
    // Start the application - listen on all interfaces (0.0.0.0)
    await app.listen(port, '0.0.0.0');
    console.log(`Application is running on: http://0.0.0.0:${port}`);
    console.log(`Access health check at: http://your-public-ip:${port}/health`);
  } catch (error) {
    console.error('Application startup error:', error);
    if (error instanceof TypeORMError) {
      console.error('Database connection error:', error.message);
    }
    process.exit(1);
  }
}

bootstrap();