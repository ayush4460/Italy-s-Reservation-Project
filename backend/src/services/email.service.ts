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

  sendSignupOTP: async (email: string, otp: string, restaurantName: string = "Italy's Reservation") => {
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
            <h2 class="greeting">Hello ${restaurantName},</h2>
            <p class="message">
              Your OTP for signup to Italy's Reservation is:
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
        subject: `Signup OTP - ${otp}`,
        html,
      });
      console.log('Signup OTP sent successfully to', email);
    } catch (error) {
      console.error('Error sending signup OTP email:', error);
      throw new Error('Failed to send Signup OTP email');
    }
  },

  sendEmailChangeOTP: async (email: string, otp: string, name: string, restaurantName: string = "Italy's Reservation") => {
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
              We received a request to change your account email. Use the code below to verify your new email address:
            </p>
            <div class="otp-container">
              <p class="otp-code">${otp}</p>
            </div>
            <p class="message">
              This code is valid for <strong>3 minutes</strong>. <br/>
              <strong>Note:</strong> Once verified, you must use this new email to login.
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
        subject: `Verify New Email - ${restaurantName}`,
        html,
      });
      console.log('Email Change OTP sent successfully to', email);
    } catch (error) {
      console.error('Error sending email change OTP email:', error);
      throw new Error('Failed to send Email Change OTP email');
    }
  },

  sendStaffRegistrationOTP: async (email: string, otp: string, restaurantName: string = "Italy's Reservation") => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px 0; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; }
          .content { padding: 40px; text-align: center; }
          .greeting { color: #333; font-size: 20px; margin-bottom: 20px; }
          .message { color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
          .otp-container { background-color: #eff6ff; border-radius: 12px; padding: 15px 30px; display: inline-block; margin-bottom: 30px; border: 2px dashed #3b82f6; }
          .otp-code { color: #1e3a8a; font-size: 32px; font-weight: 700; letter-spacing: 5px; margin: 0; }
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
            <h2 class="greeting">Staff Invitation</h2>
            <p class="message">
              You have been invited to join the staff at <strong>${restaurantName}</strong>. 
              Please use the verification code below to confirm your email and complete your registration:
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
            <p>This is an automated message for staff registration.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await transporter.sendMail({
        from: `"${restaurantName}" <${SMTP_USER}>`,
        to: email,
        subject: `Verify Your Email - Staff Registration`,
        html,
      });
      console.log('Staff Registration OTP sent successfully to', email);
    } catch (error) {
      console.error('Error sending staff registration OTP email:', error);
      throw new Error('Failed to send Staff Registration OTP email');
    }
  },

  sendStaffEmailChangeOTP: async (email: string, otp: string, staffName: string, restaurantName: string = "Italy's Reservation") => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; }
          .header { background: linear-gradient(135deg, #4b5563 0%, #1f2937 100%); padding: 30px 0; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; }
          .content { padding: 40px; text-align: center; }
          .greeting { color: #333; font-size: 20px; margin-bottom: 20px; }
          .message { color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
          .otp-container { background-color: #f3f4f6; border-radius: 12px; padding: 15px 30px; display: inline-block; margin-bottom: 30px; border: 2px dashed #9ca3af; }
          .otp-code { color: #111827; font-size: 32px; font-weight: 700; letter-spacing: 5px; margin: 0; }
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
            <h2 class="greeting">Hello ${staffName},</h2>
            <p class="message">
              Your account email address is being updated at <strong>${restaurantName}</strong>. 
              Please use the verification code below to confirm this change:
            </p>
            <div class="otp-container">
              <p class="otp-code">${otp}</p>
            </div>
            <p class="message">
              This code is valid for <strong>3 minutes</strong>. <br/>
              Once verified, you must use this new email to login to your staff account.
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
        subject: `Confirm Your New Staff Email - ${restaurantName}`,
        html,
      });
      console.log('Staff Email Change OTP sent successfully to', email);
    } catch (error) {
      console.error('Error sending staff email change OTP email:', error);
      throw new Error('Failed to send Staff Email Change OTP email');
    }
  },

  sendWhatsAppNotification: async (
      email: string, 
      data: {
        customerName: string;
        phoneNumber: string;
        message: string;
        timestamp: Date;
        restaurantName?: string;
        ownerName?: string;
      }
    ) => {
      const restaurantName = data.restaurantName || "Italy's Reservation";
      const ownerName = data.ownerName || "Admin"; // Fallback to Admin
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const replyLink = `${frontendUrl}/dashboard/chat`;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden; }
            .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px 0; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; display: flex; align-items: center; justify-content: center; gap: 10px; }
            .content { padding: 40px; }
            .greeting { color: #333; font-size: 20px; margin-bottom: 20px; text-align: center; }
            .message-card { background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 12px; padding: 20px; margin-bottom: 30px; }
            .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .value { font-size: 16px; color: #111827; font-weight: 500; margin-bottom: 16px; }
            .message-text { background-color: #ffffff; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; font-style: italic; color: #374151; margin-top: 10px; }
            .button-container { text-align: center; margin-top: 30px; }
            .reply-button { background-color: #10b981; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; transition: background-color 0.2s; }
            .reply-button:hover { background-color: #059669; }
            .footer { background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee; }
            .footer p { color: #999; font-size: 12px; margin: 5px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New WhatsApp Message</h1>
            </div>
            <div class="content">
              <h2 class="greeting">Hello ${ownerName},</h2>
              <p style="text-align: center; color: #666; margin-bottom: 30px;">
                You have received a new message on your business WhatsApp.
              </p>
              
              <div class="message-card">
                <div class="label">From</div>
                <div class="value">${data.customerName || 'Unknown'} <span style="color: #9ca3af; font-weight: normal;">(${data.phoneNumber})</span></div>
                
                <div class="label">Time</div>
                <div class="value">${new Date(data.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
                
                <div class="label">Message</div>
                <div class="message-text">
                  "${data.message}"
                </div>
              </div>

              <div class="button-container">
                <a href="${replyLink}" class="reply-button">Reply Now</a>
              </div>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ${restaurantName}. All rights reserved.</p>
              <p>This notification was sent instantly upon receiving the message.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await transporter.sendMail({
          from: `"${restaurantName}" <${SMTP_USER}>`,
          to: email,
          subject: `New Message from ${data.customerName || data.phoneNumber}`,
          html,
        });
        console.log('WhatsApp Notification sent to', email);
      } catch (error) {
        console.error('Error sending WhatsApp notification:', error);
        // Don't throw logic error here to prevent blocking the main webhook flow
      }
    },
};
