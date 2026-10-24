import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private resend = new Resend(process.env.RESEND_API_KEY);

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
    const { data, error } = await this.resend.emails.send({
      from: 'Instagram App <onboarding@resend.dev>',
      to: email,
      subject: 'Password Reset OTP',
      text: `Your password reset OTP is ${otp}. It expires in 5 minutes.`,
    });

    if (error) {
      console.error('Resend error:', error);
      throw new InternalServerErrorException('Failed to send OTP email');
    }
  }
}
