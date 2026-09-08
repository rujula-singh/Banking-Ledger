import nodemailer from 'nodemailer';
import config from '../config/config.js'

let transporter = null;

function getTransporter() {
  if (!transporter && config.EMAIL_USER && config.CLIENT_ID) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: config.EMAIL_USER,
        clientId: config.CLIENT_ID,
        clientSecret: config.CLIENT_SECRET,
        refreshToken: config.REFRESH_TOKEN
      }
    });
  }
  return transporter;
}

export const sendEmail = async (to, subject, text, html) => {
  try {
    if (!config.EMAIL_USER || !config.CLIENT_ID) {
      console.log(`[Mock Email] To: ${to} | Subject: ${subject}`);
      return;
    }
    const client = getTransporter();
    if (!client) {
      console.log(`[Mock Email] To: ${to} | Subject: ${subject}`);
      return;
    }
    const info = await client.sendMail({
      from: `Backend Ledger <${config.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('Message sent to %s', info.messageId);
  } catch (error) {
    console.warn('[Email Service Warning] Could not send email (credentials may be unconfigured):', error.message);
  }
};

export async function sendRegistrationEmail(userEmail, name) {
  const subject = 'Welcome to Personal Banking Platform';
  const text = `Hello ${name},\n\nThank you for registering at Personal Banking Platform. We're excited to have you on board!\n\nBest regards,\nThe Banking Team`;
  const html = `<p>Hello ${name},</p><p>Thank you for registering at Personal Banking Platform. We're excited to have you on board!</p><p>Best regards,<br>The Banking Team</p>`;

  await sendEmail(userEmail, subject, text, html);
}

export async function sendTransactionEmail(userEmail, name, amount, toAccount) {
  const subject = 'Transaction Successful!';
  const text = `Hello ${name},\n\nYour transaction of ₹${amount} to account ${toAccount} was successful.\n\nBest regards,\nThe Banking Team`;
  const html = `<p>Hello ${name},</p><p>Your transaction of <strong>₹${amount}</strong> to account <code>${toAccount}</code> was successful.</p><p>Best regards,<br>The Banking Team</p>`;

  await sendEmail(userEmail, subject, text, html);
}

export async function sendTransactionFailureEmail(userEmail, name, amount, account, toAccount, reason) {
  const subject = 'Transaction Notice: Transfer Unsuccessful';
  const text = `Hello ${name},\n\nWe couldn't complete your transfer of ₹${amount} to account ${toAccount}. Your balance was not affected.\nReason: ${reason || 'System verification'}\n\nBest regards,\nThe Banking Team`;
  const html = `<p>Hello ${name},</p><p>We couldn't complete your transfer of <strong>₹${amount}</strong> to account <code>${toAccount}</code>. <em>Your account balance was not affected.</em></p><p>Reason: ${reason || 'System verification'}</p><p>Best regards,<br>The Banking Team</p>`;

  await sendEmail(userEmail, subject, text, html);
}
