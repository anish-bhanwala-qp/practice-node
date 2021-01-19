const nodemailer = require('nodemailer');
const emailTransporter = require('../config/emailTransporter');

const sendAccountActivation = async (email, token) => {
  const info = await emailTransporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account Activation',
    html: `
    <div>
      <b>Please click below link to activate your account</b>
    </div>
    <div>
      <a href="http://localhost:4002/#login?token=${token}">Activate</a>
    </div>
    `,
  });
  if (process.env.NODE_ENV === 'development') {
    console.log(`url: ${nodemailer.getTestMessageUrl(info)}`);
  }
};

const sendPasswordReset = async (email, token) => {
  const info = await emailTransporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Password Reset Link',
    html: `
    <div>
      <b>Please click below link to activate your account</b>
    </div>
    <div>
      <a href="http://localhost:4002/#user/password?reset=${token}">Reset</a>
    </div>
    `,
  });
  if (process.env.NODE_ENV === 'development') {
    console.log(`url: ${nodemailer.getTestMessageUrl(info)}`);
  }
};

module.exports = {
  sendAccountActivation,
  sendPasswordReset,
};
