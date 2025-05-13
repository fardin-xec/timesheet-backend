import { Controller, Get, Inject, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HttpHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private configService: ConfigService,
  ) {}

  /**
   * Basic health check endpoint to verify the service is running.
   * Checks if the service can respond to requests.
   */
  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    try {
      return await this.health.check([
        // Check if the service is responsive
        async (): Promise<HealthIndicatorResult> => ({
          service: { status: 'up' },
        }),
      ]);
    } catch (error) {
      this.logger.error(`Basic health check failed: ${error.message}`);
      throw error; // Let Terminus handle the error response
    }
  }

  /**
   * Detailed health check endpoint to verify service and its dependencies.
   * Checks external API, disk storage, and memory usage.
   */
  @Get('detailed')
  @HealthCheck()
  async checkDetailed(): Promise<HealthCheckResult> {
    try {
      // Get configuration values from environment variables
      const externalApiUrl =
        this.configService.get<string>('EXTERNAL_API_URL') || 'https://example.com';
      const diskThresholdMb =
        this.configService.get<number>('DISK_THRESHOLD_MB') || 250; // Default: 250MB
      const memoryThresholdMb =
        this.configService.get<number>('MEMORY_THRESHOLD_MB') || 150; // Default: 150MB
      const diskPath = this.configService.get<string>('DISK_PATH') || '/';

      return await this.health.check([
        // Check if the service is responsive
        async (): Promise<HealthIndicatorResult> => ({
          service: { status: 'up' },
        }),

        // Check if the external API is reachable
        () =>
          this.http.pingCheck('external-api', externalApiUrl, {
            timeout: 5000, // 5 seconds timeout
          }),

        // Check disk storage (threshold in MB)
        () =>
          this.disk.checkStorage('storage', {
            path: diskPath,
            threshold: diskThresholdMb * 1024 * 1024, // Convert MB to bytes
          }),

        // Check memory heap usage
        () =>
          this.memory.checkHeap('memory_heap', memoryThresholdMb * 1024 * 1024), // Convert MB to bytes
      ]);
    } catch (error) {
      this.logger.error(`Detailed health check failed: ${error.message}`);
      throw error; // Let Terminus handle the error response
    }
  }
}