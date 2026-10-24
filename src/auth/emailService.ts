import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

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
      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Password Reset OTP',
        text: `Your password reset OTP is ${otp}. It expires in 5 minutes.`,
      });
    } catch (e) {
      console.log(e);
    }
  }
}
