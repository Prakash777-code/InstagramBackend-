import { Injectable } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FirebaseService {
  constructor() {
    if (!getApps().length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
      initializeApp({
        credential: cert(serviceAccount),
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
