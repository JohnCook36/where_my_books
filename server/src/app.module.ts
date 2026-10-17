import { ShelvesModule } from './shelves/shelves.module.js';
import { CoversModule } from './covers/covers.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { BooksModule } from './books/books.module.js';
import { HealthController } from './health.controller.js';
import { SettingsModule } from './settings/settings.module.js';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, ShelvesModule, CoversModule, CatalogModule, BooksModule, SettingsModule], controllers: [HealthController] })
export class AppModule {}
