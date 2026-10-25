import { Brevo, BrevoClient } from '@getbrevo/brevo';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY!,
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
      await this.brevo.transactionalEmails.sendTransacEmail({
        sender: {
          name: 'InstagramTeam',
          email: 'prakaxkumar@gmail.com',
        },
        to: [{ email }],
        subject: 'Password reset OTP',
        textContent: `Your password reset OTP is ${otp}. It expires in 5 minutes.`,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}
