import nodemailer from 'nodemailer';
import config from '../config/config.js'

const transporter = nodemailer.createTransport({
  service:'gmail',
  auth: {
    type:'OAuth2',
    user:config.EMAIL_USER,
    clientId:config.CLIENT_ID,
    clientSecret:config.CLIENT_SECRET,
    refreshToken:config.REFRESH_TOKEN
  }
})

transporter.verify((error,success)=>{
  if(error) {
    console.error('Error connecting to email server:',error);
  }
  else {
    console.log('Email server is ready to send messages');
  }
});

export const sendEmail = async (to, subject,text,html) => {
  try {
    const info = await transporter.sendMail({
      from : `Backend Ledger <${config.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('Message sent to %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch(error) {
    console.error('Error sending email:', error);
  }
}
export async function sendRegisterationEmail(userEmail, name) {
  const subject = 'Welcome to Backend Ledger';
  const text = `Hello ${name},\n\nThank you for registering at Backend Ledger.
  We're excited to have you on board!\n\nBest regards,\nThe Backend Ledger Team`;
  const html = `<p>Hello ${name},<p></p>Thank you for registering at Backend
  Ledger. We're excited to have you on board!<p></p>Best regards, <br>The Backend Ledger</p>`;

  await sendEmail(userEmail, subject,text,html);
}

export async function sendTransactionEmail(userEmail, name,amount,toAccount) {
  const subject = 'Transaction Successful!';
  const text = `Hello ${name},\n\nYour transaction of ${amount} to account ${toAccount} was successful.
  \n\nBest reagrds,\nThe Backend Ledger Team `;
  const html = `<p>Hello ${name},</p><p>Your transaction of ${amount} to account ${toAccount} was successful.
  </p><p>Best regards,<br>The Backend Ledger Team </br></p>`

  await sendEmail(userEmail,subject,text,html);
}

export async function sendTransactionFailureEmail(userEmail,name,account,toAccount) {
   const subject = 'Transaction Failed!';
  const text = `Hello ${name},\n\nWe regret to inform you that your transaction of ${amount} to account ${toAccount} has failed.
  \n\nBest reagrds,\nThe Backend Ledger Team `;
  const html = `<p>Hello ${name},</p><p>We regret to inform you that your transaction of ${amount} to account ${toAccount} has failed.
  </p><p>Best regards,<br>The Backend Ledger Team </br></p>`

  await sendEmail(userEmail,subject,text,html);
}
