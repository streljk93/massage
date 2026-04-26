import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';

@Module({
  providers: [MailTemplateService, MailService],
  exports: [MailService],
})
export class MailModule {}
