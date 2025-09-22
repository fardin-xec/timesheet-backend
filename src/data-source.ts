import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const isCompiled = path.extname(__filename) === '.js';
const entitiesPath = isCompiled
  ? path.join(__dirname, 'entities', '*.js')
  : path.join(__dirname, 'entities', '*.ts');
const migrationsPath = isCompiled
  ? path.join(__dirname, 'migrations', '*.js')
  : path.join(__dirname, 'migrations', '*.ts');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  logging: true,
  entities: [entitiesPath],
  migrations: [migrationsPath],
});
