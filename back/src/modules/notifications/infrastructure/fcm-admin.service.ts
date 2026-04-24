import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FcmAdminService implements OnModuleInit {
  private readonly logger = new Logger(FcmAdminService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) {
      return;
    }
    const json = this.config.get<string>('firebase.serviceAccountJson') ?? '';
    try {
      if (json) {
        const creds = JSON.parse(json) as admin.ServiceAccount;
        admin.initializeApp({ credential: admin.credential.cert(creds) });
        this.logger.log(
          'Firebase Admin: initialized from FIREBASE_SERVICE_ACCOUNT_JSON',
        );
        return;
      }
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp();
        this.logger.log(
          'Firebase Admin: initialized from GOOGLE_APPLICATION_CREDENTIALS',
        );
        return;
      }
      this.logger.warn(
        'Firebase Admin: not configured; FCM send is disabled (see FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS).',
      );
    } catch (e) {
      this.logger.error(`Firebase Admin: init failed: ${e}`);
    }
  }

  get isEnabled(): boolean {
    return admin.apps.length > 0;
  }

  get messaging(): admin.messaging.Messaging {
    return admin.messaging();
  }
}
