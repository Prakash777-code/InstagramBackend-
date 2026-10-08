import { Injectable } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService {
  constructor() {
    if (!getApps().length) {
      initializeApp({
        credential: cert(require('../../firebase-service-account.json')),
      });
    }
  }

  getMessaging() {
    return getMessaging();
  }

  async sendNotification(fcmToken: string, title: string, body: string) {
    return this.getMessaging().send({
      token: fcmToken,
      notification: {
        title,
        body,
      },
    });
  }

  async sendMultipleNotifications(
    fcmTokens: string[],
    title: string,
    body: string,
  ) {
    return this.getMessaging().sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
    });
  }
}
