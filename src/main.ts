import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TypeORMError } from 'typeorm/error/TypeORMError';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the configuration service to access environment variables
  const configService = app.get(ConfigService);

  // Set the port from the environment variable
  const port = configService.get<number>('PORT');

  // Enable CORS if needed
  app.enableCors();

  // Apply the global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

 

    try {
        // Start the application
        await app.listen(port);
        console.log(`Application is running on: http://localhost:${port}`);
    } catch (error) {

        console.error('Database connection error:', error);
      if (error instanceof TypeORMError) {

        console.error('Database connection error:', error.message);
      }
      process.exit(1);
    }
  
}

bootstrap();
