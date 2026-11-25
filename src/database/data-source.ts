import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AutoPartEntity } from '../auto-parts/entities/auto-part.entity.js';
import { CarModelEntity } from '../auto-parts/entities/car-model.entity.js';
import { CompatibilityCodeEntity } from '../auto-parts/entities/compatibility-code.entity.js';
import { SpecificationEntity } from '../auto-parts/entities/specification.entity.js';
import { PartRequestEntity } from '../notifications/entities/part-request.entity.js';
import { UserEntity } from '../users/entities/user.entity.js';

/**
 * Джерело даних для TypeORM CLI.
 * Використовується лише командами migration:generate / run / revert / show,
 * тому працює зі скомпільованими файлами з каталогу dist.
 *
 * Сутності перелічені явно й у сталому порядку: AutoPartEntity першою,
 * бо її декоратор посилається на CarModelEntity через emitDecoratorMetadata.
 * Глоб-шаблон давав непередбачуваний порядок завантаження і падав
 * на циклічному звʼязку 1:M під час старту міграцій.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5435),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'auto_parts_p11',
  entities: [
    AutoPartEntity,
    CarModelEntity,
    CompatibilityCodeEntity,
    SpecificationEntity,
    PartRequestEntity,
    UserEntity,
  ],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  logging: ['schema'],
});
