import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM;

async function testEmail() {
    console.log('Testing SMTP with:');
    console.log('User:', SMTP_USER);
    console.log('From:', SMTP_FROM);
    
    // Test with explicit config
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS, // Try original first (with spaces)
        },
    });



    try {
        const info = await transporter.sendMail({
            from: `"SMTP Test" <${SMTP_FROM}>`,
            to: SMTP_USER, // Send to self
            subject: 'SMTP Test Email',
            text: 'This is a test email to verify SMTP configuration.',
            html: '<b>This is a test email to verify SMTP configuration.</b>',
        });

        console.log('Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
    } catch (error) {
        console.error('Failed to send email:');
        console.error(error);
        process.exit(1);
    }
}

testEmail();
