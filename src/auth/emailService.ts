import { Brevo, BrevoClient } from '@getbrevo/brevo';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { Client } from 'node-mailjet';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY!,
  });
  private readonly mailjet = new Client({
    apiKey: process.env.MAILJET_API_KEY!,
    apiSecret: process.env.MAILJET_SECRET_KEY!,
  });
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendOtp(email: string, otp: string) {
    try {
      const result = await this.mailjet
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: process.env.MAILJET_FROM_EMAIL!,
                Name: 'Prakash',
              },
              To: [{ Email: email }],
              Subject: 'Password reset OTP',
              TextPart: `Your password reset OTP is ${otp}. It expires in 5 minutes.`,
            },
          ],
        });
    } catch (error) {
      console.error('Mailjet error:', error);
      throw error;
    }
  }
}
