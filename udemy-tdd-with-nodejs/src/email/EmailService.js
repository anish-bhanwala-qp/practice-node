const emailTransporter = require('../config/emailTransporter');

const sendAccountActivation = async (email, token) => {
  await emailTransporter.sendMail({
    from: 'My App <info@my-app.com>',
    to: email,
    subject: 'Account Activation',
    html: `Token is ${token}`,
  });
};

module.exports = {
  sendAccountActivation,
};
