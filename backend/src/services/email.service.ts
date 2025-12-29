import nodemailer from 'nodemailer';

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

export const EmailService = {
  sendOTP: async (email: string, otp: string, restaurantName: string = "Italy's Reservation") => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #f9f9f9;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            margin-top: 40px;
            margin-bottom: 40px;
          }
          .header {
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            padding: 40px 0;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            letter-spacing: 1px;
            font-weight: 300;
          }
          .content {
            padding: 40px;
            text-align: center;
          }
          .greeting {
            color: #333333;
            font-size: 20px;
            margin-bottom: 20px;
          }
          .message {
            color: #666666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
          }
          .otp-container {
            background-color: #f0f4f8;
            border-radius: 12px;
            padding: 20px;
            display: inline-block;
            margin-bottom: 30px;
            border: 2px dashed #d1d9e6;
          }
          .otp-code {
            color: #2c3e50;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 5px;
            margin: 0;
          }
          .warning {
            color: #e74c3c;
            font-size: 14px;
            font-weight: 500;
            margin-top: 20px;
          }
          .footer {
            background-color: #f9f9f9;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #eeeeee;
          }
          .footer p {
             color: #999999;
             font-size: 12px;
             margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${restaurantName}</h1>
          </div>
          <div class="content">
            <h2 class="greeting">Password Reset Request</h2>
            <p class="message">
              We received a request to reset your password. Use the verification code below to proceed.
            </p>
            
            <div class="otp-container">
              <p class="otp-code">${otp}</p>
            </div>

            <p class="message">
              This code is valid for <strong>3 minutes</strong>.
            </p>
            
            <p class="warning">
              If you did not request this, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${restaurantName}. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: `"${restaurantName}" <${SMTP_USER}>`,
        to: email,
        subject: `Start Password Reset - ${otp}`,
        html,
      });
      console.log('OTP sent successfully to', email);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send OTP email');
    }
  },

  sendLoginOTP: async (email: string, otp: string, name: string, restaurantName: string = "Italy's Reservation") => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; }
          .header { background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 30px 0; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; }
          .content { padding: 40px; text-align: center; }
          .greeting { color: #333; font-size: 20px; margin-bottom: 20px; }
          .message { color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
          .otp-container { background-color: #f0f4f8; border-radius: 12px; padding: 15px 30px; display: inline-block; margin-bottom: 30px; border: 2px dashed #d1d9e6; }
          .otp-code { color: #2c3e50; font-size: 32px; font-weight: 700; letter-spacing: 5px; margin: 0; }
          .footer { background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee; }
          .footer p { color: #999; font-size: 12px; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${restaurantName}</h1>
          </div>
          <div class="content">
            <h2 class="greeting">Hello ${name},</h2>
            <p class="message">
              Your OTP for login is:
            </p>
            <div class="otp-container">
              <p class="otp-code">${otp}</p>
            </div>
            <p class="message">
              This code is valid for <strong>3 minutes</strong>.
            </p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${restaurantName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: `"${restaurantName}" <${SMTP_USER}>`,
        to: email,
        subject: `Login OTP - ${otp}`,
        html,
      });
      console.log('Login OTP sent successfully to', email);
    } catch (error) {
      console.error('Error sending login OTP email:', error);
      throw new Error('Failed to send Login OTP email');
    }
  },
};
