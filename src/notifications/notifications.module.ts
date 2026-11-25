import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutoPartsModule } from '../auto-parts/auto-parts.module.js';
import { PartRequestEntity } from './entities/part-request.entity.js';
import { EventsGateway } from './events.gateway.js';
import { MailService } from './mail.service.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PartRequestEntity]), AutoPartsModule],
  controllers: [NotificationsController],
  providers: [EventsGateway, NotificationsService, MailService],
  exports: [EventsGateway, NotificationsService, MailService],
})
export class NotificationsModule {}
