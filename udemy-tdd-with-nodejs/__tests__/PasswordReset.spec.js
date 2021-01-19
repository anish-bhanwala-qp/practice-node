const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const en = require('../locales/en/translation.json');
const hi = require('../locales/hi/translation.json');
const User = require('../src/user/User');
const bcrypt = require('bcrypt');
const { SMTPServer } = require('smtp-server');
const config = require('config');

let lastMail;
let server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody = '';
      stream.on('data', (data) => {
        mailBody += data.toString();
      });

      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new Error('Invalid mailbox');
          err.responseCode = 553;
          return callback(err);
        }

        lastMail = mailBody;
        callback();
      });
    },
  });

  server.listen(config.mail.port, 'localhost');

  await sequelize.sync();
});

beforeEach(async () => {
  simulateSmtpFailure = false;
  await User.destroy({
    truncate: {
      cascade: true,
    },
  });
});

afterAll(async () => {
  await server.close();
});

const activeUser = {
  username: 'user1',
  email: 'user1@mail.com',
  password: 'P4ssword',
  inactive: false,
};

const addUser = async (user = activeUser) => {
  user = { ...user };
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;

  return await User.create(user);
};

const passwordReset = (email = 'user1@mail.com', options = {}) => {
  const agent = request(app).post('/api/1.0/user/password');

  if (options.language) {
    agent.set('accept-language', options.language);
  }
  return agent.send({ email });
};

const passwordUpdate = (body = {}, options = {}) => {
  const agent = request(app).put('/api/1.0/user/password');

  if (options.language) {
    agent.set('accept-language', options.language);
  }
  return agent.send(body);
};

describe('Password Reset Request', () => {
  it('returns 404 when a password reset request is sent from unknown email', async () => {
    const response = await passwordReset();
    expect(response.status).toBe(404);
  });

  it.each`
    language | message
    ${'en'}  | ${en.email_not_in_use}
    ${'hi'}  | ${hi.email_not_in_use}
  `(
    `returns error body with message "$message" when unknown email for password reset`,
    async ({ message, language }) => {
      const nowInMillis = new Date().getTime();
      const response = await passwordReset('user1@mail.com', { language });
      const error = response.body;
      expect(error.message).toBe(message);
      expect(error.path).toBe('/api/1.0/user/password');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it.each`
    language | message
    ${'en'}  | ${en.email_valid}
    ${'hi'}  | ${hi.email_valid}
  `(
    `returns error body with message "$message" when unknown email for password reset`,
    async ({ message, language }) => {
      const nowInMillis = new Date().getTime();
      const response = await passwordReset(null, { language });
      const error = response.body;
      expect(error.validationErrors.email).toBe(message);
      expect(error.path).toBe('/api/1.0/user/password');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it('returns 200 when a password reset request is sent from valid email', async () => {
    await addUser();
    const response = await passwordReset();
    expect(response.status).toBe(200);
  });

  it.each`
    language | message
    ${'en'}  | ${en.password_reset_success}
    ${'hi'}  | ${en.password_reset_success}
  `(
    `returns body with message "$message" for known email for password reset`,
    async ({ message, language }) => {
      await addUser();
      const response = await passwordReset('user1@mail.com', { language });
      expect(response.body.message).toBe(message);
    }
  );

  it('creates passwordResetToken when a password reset request is sent from valid email', async () => {
    await addUser();
    await passwordReset();

    const userInDb = await User.findOne({ where: { email: activeUser.email } });
    expect(userInDb.passwordResetToken).not.toBeUndefined();
  });

  it('sends email with passwordResetToken when a password reset request is sent from valid email', async () => {
    await addUser();
    await passwordReset();

    const userInDb = await User.findOne({ where: { email: activeUser.email } });

    expect(lastMail).toContain(userInDb.email);
    expect(lastMail).toContain(userInDb.passwordResetToken);
  });

  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    await addUser();
    const response = await passwordReset();
    expect(response.status).toBe(502);
  });

  it('returns Email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    await addUser();
    const response = await passwordReset();
    expect(response.body.message).toBe('Email failure');
  });
});

describe('Password Update', () => {
  it('returns 403 when password update request does not have the valid password', async () => {
    const response = await passwordUpdate();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'en'}  | ${en.unauthorized_password_reset}
    ${'hi'}  | ${hi.unauthorized_password_reset}
  `(
    `returns error body with message "$message" when language is set to "$language" after trying to update password with invalid token`,
    async ({ message, language }) => {
      const nowInMillis = new Date().getTime();
      const response = await passwordUpdate(
        {
          password: 'P4ssword',
          passwordResetToken: 'wrong-token',
        },
        { language }
      );
      const error = response.body;
      expect(error.message).toBe(message);
      expect(error.path).toBe('/api/1.0/user/password');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it('returns 403 when password update request with invalid password pattern and the reset token is invalid', async () => {
    const response = await passwordUpdate({
      password: 'short',
      passwordResetToken: 'invalid-token',
    });
    expect(response.status).toBe(403);
  });

  it('returns 400 when password update request with invalid password pattern and the reset token is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await passwordUpdate({
      password: null,
      passwordResetToken: user.passwordResetToken,
    });
    expect(response.status).toBe(400);
  });

  it('returns 200 when password update request is sent with valid password pattern and the reset token is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    const response = await passwordUpdate({
      password: 'thisisvalidpassword',
      passwordResetToken: user.passwordResetToken,
    });
    expect(response.status).toBe(200);
  });

  it('updates passsword in database when password update request is sent with valid password pattern and the reset token is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await passwordUpdate({
      password: 'thisisvalidpassword',
      passwordResetToken: user.passwordResetToken,
    });

    const updatedUserInDb = await User.findOne({ where: { id: user.id } });
    expect(user.password).not.toBe(updatedUserInDb.password);
  });

  it('clears passwordResetToken when request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await user.save();
    await passwordUpdate({
      password: 'thisisvalidpassword',
      passwordResetToken: user.passwordResetToken,
    });

    const updatedUserInDb = await User.findOne({ where: { id: user.id } });
    expect(updatedUserInDb.passwordResetToken).toBeFalsy();
  });
});
