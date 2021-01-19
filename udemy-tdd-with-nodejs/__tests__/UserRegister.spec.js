const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const SmtpServer = require('smtp-server').SMTPServer;
const en = require('../locales/en/translation.json');
const hi = require('../locales/hi/translation.json');
const config = require('config');

let lastMail;
let server;
let simulateSmtpFailure = false;

beforeAll(async () => {
  server = new SmtpServer({
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

  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync();
  }
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

const validUser = {
  username: 'user1',
  email: 'user1@email.com',
  password: 'password',
};

const postUser = (user = validUser, options = {}) => {
  const agent = request(app).post('/api/1.0/users');
  if (options.language) {
    agent.set('accept-language', options.language);
  }

  return agent.send(user);
};

describe('User Registration', () => {
  it('returns 200 Ok when signup request is valid', async () => {
    const res = await postUser();
    expect(res.status).toBe(200);
  });

  it('returns success messaage when signup request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe('User created');
  });

  it('saves the user to the database when signup request is valid', async () => {
    await postUser();
    const userList = await User.findAll();
    expect(userList.length).toBe(1);
  });

  it('saves the username and email to database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@email.com');
  });

  it('hashes the password in the database', async () => {
    await postUser();
    const userList = await User.findAll();
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe('pAssword');
  });

  it('returns 400 when username is null', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@email.com',
      password: 'pAssword',
    });

    expect(response.status).toBe(400);
  });

  it('returns validationErrors field in response body when validation error occurs', async () => {
    const response = await postUser({
      username: null,
      email: 'user1@email.com',
      password: 'pAssword',
    });

    const body = response.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it('returns errors for when both email and username are null', async () => {
    const response = await postUser({
      username: null,
      email: null,
      password: 'pAssword',
    });

    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it.each`
    field         | value               | errorMessage
    ${'username'} | ${null}             | ${en.username_null}
    ${'username'} | ${'use'}            | ${en.username_size}
    ${'username'} | ${'u'.repeat(33)}   | ${en.username_size}
    ${'email'}    | ${null}             | ${en.email_null}
    ${'email'}    | ${'invaldEmail'}    | ${en.email_valid}
    ${'email'}    | ${'user.email.com'} | ${en.email_valid}
    ${'email'}    | ${'user@email'}     | ${en.email_valid}
    ${'password'} | ${null}             | ${en.password_null}
    ${'password'} | ${'12345'}          | ${en.password_size}
  `(
    'returns "$errorMessage" when $field is $value',
    async ({ field, value, errorMessage }) => {
      const user = {
        username: 'user1',
        email: 'user1@email1.com',
        password: 'pAssword',
      };

      user[field] = value;
      const response = await postUser(user);
      const body = response.body;
      expect(body.validationErrors[field]).toBe(errorMessage);
    }
  );

  const email_in_use = 'Email already in use';

  it(`returns "Email${email_in_use}" when same email is already in use`, async () => {
    await User.create({ ...validUser });
    const response = await postUser();

    const body = response.body;
    expect(body.validationErrors.email).toBe(email_in_use);
  });

  it('returns errors for both username is null and email alread in use', async () => {
    await User.create({ ...validUser });
    const response = await postUser({
      ...validUser,
      username: null,
    });

    const body = response.body;
    expect(body.validationErrors.email).not.toBeUndefined();
    expect(body.validationErrors.username).not.toBeUndefined();
  });

  it('creaates user in inactive mode', async () => {
    await postUser();
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creaates user in inactive mode even if the request body contains inactive false', async () => {
    const user = { ...validUser };
    user.inactive = false;
    await postUser(user);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates an activationToken for user', async () => {
    const user = { ...validUser };
    user.inactive = false;
    await postUser(user);
    const users = await User.findAll();
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it('sends an account activation email with activationToken', async () => {
    await postUser();

    const users = await User.findAll();
    const savedUser = users[0];

    expect(lastMail).toContain('user1@email.com');
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;

    const response = await postUser();
    expect(response.status).toBe(502);
  });

  it('returns Email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;

    const response = await postUser();
    expect(response.body.message).toBe('Email failure');
  });

  it('does not save user to database when sending email fails', async () => {
    simulateSmtpFailure = true;

    await postUser();
    const users = await User.findAll();
    expect(users.length).toBe(0);
  });

  it('returns "Validation Failure" message in error response body when validation fails', async () => {
    const response = await postUser({ ...validUser, email: 'invalid@email' });

    const body = response.body;
    expect(body.message).toBe('Validation Failure');
  });
});

describe('Internationalization', () => {
  it.each`
    field         | value               | errorMessage
    ${'username'} | ${null}             | ${hi.username_null}
    ${'username'} | ${'use'}            | ${hi.username_size}
    ${'username'} | ${'u'.repeat(33)}   | ${hi.username_size}
    ${'email'}    | ${null}             | ${hi.email_null}
    ${'email'}    | ${'invaldEmail'}    | ${hi.email_valid}
    ${'email'}    | ${'user.email.com'} | ${hi.email_valid}
    ${'email'}    | ${'user@email'}     | ${hi.email_valid}
    ${'password'} | ${null}             | ${hi.password_null}
    ${'password'} | ${'12345'}          | ${hi.password_size}
  `(
    'returns "$errorMessage" when $field is $value when language is HINDI',
    async ({ field, value, errorMessage }) => {
      const user = {
        username: 'user1',
        email: 'user1@email1.com',
        password: 'pAssword',
      };

      user[field] = value;
      const response = await postUser(user, { language: 'hi' });
      const body = response.body;
      expect(body.validationErrors[field]).toBe(errorMessage);
    }
  );

  const user_created = 'उपयोगकर्ता बनाया गया';
  it(`returns "${user_created}" when signup request is valid`, async () => {
    const response = await postUser({ ...validUser }, { language: 'hi' });
    expect(response.body.message).toBe(user_created);
  });

  const email_in_use = 'ईमेल पहले से उपयोग में है';
  it(`returns "${email_in_use}" when same email is already in use when language is HINDI`, async () => {
    await User.create({ ...validUser });
    const response = await postUser({ ...validUser }, { language: 'hi' });

    const body = response.body;
    expect(body.validationErrors.email).toBe(email_in_use);
  });

  const email_failure = 'ईमेल की विफलता';
  it(`returns "${email_failure}" message when sending email fails`, async () => {
    simulateSmtpFailure = true;

    const response = await postUser({ ...validUser }, { language: 'hi' });
    expect(response.body.message).toBe(email_failure);
  });
});

describe('Account Activation', () => {
  it('activates the account when correct token is sent', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    users = await User.findAll();
    const user = users[0];
    expect(user.inactive).toBe(false);
  });

  it('removes the token from user table after successful activation', async () => {
    await postUser();
    let users = await User.findAll();
    const token = users[0].activationToken;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    users = await User.findAll();
    const user = users[0];
    expect(user.activationToken).toBeFalsy();
  });

  it('does not activate account when token is wrong', async () => {
    await postUser();
    const token = 'invalid-token-value';

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    const users = await User.findAll();
    const user = users[0];
    expect(user.inactive).toBe(true);
  });

  it('returns bad request when token is wrong', async () => {
    await postUser();
    const token = 'invalid-token-value';

    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();

    expect(response.status).toBe(400);
  });

  it.each`
    language | tokenStatus  | message
    ${'hi'}  | ${'wrong'}   | ${hi.account_activation_failure}
    ${'hi'}  | ${'correct'} | ${hi.account_activation_success}
    ${'en'}  | ${'wrong'}   | ${en.account_activation_failure}
    ${'en'}  | ${'correct'} | ${en.account_activation_success}
  `(
    'returns $message when wrong token is sent and langauge is $language',
    async ({ language, message, tokenStatus }) => {
      let token;
      if (tokenStatus === 'wrong') {
        token = 'invalid-token-value';
      } else {
        await postUser();
        const users = await User.findAll();
        token = users[0].activationToken;
      }

      const response = await request(app)
        .post('/api/1.0/users/token/' + token)
        .set('accept-language', language)
        .send();

      expect(response.body.message).toBe(message);
    }
  );

  describe('Error Model', () => {
    it('returns path, timestamp, message and validationErrors in response when validation fails', async () => {
      const response = await postUser({ ...validUser, username: null });
      const body = response.body;
      expect(Object.keys(body)).toEqual([
        'path',
        'timestamp',
        'message',
        'validationErrors',
      ]);
    });

    it('returns path, timestamp, message in response when request fails other than validation error', async () => {
      await postUser();
      const token = 'invalid-token-value';

      const response = await request(app)
        .post('/api/1.0/users/token/' + token)
        .send();

      expect(Object.keys(response.body)).toEqual([
        'path',
        'timestamp',
        'message',
      ]);
    });

    it('returns path in error body', async () => {
      await postUser();
      const token = 'invalid-token-value';

      const response = await request(app)
        .post('/api/1.0/users/token/' + token)
        .send();

      expect(response.body.path).toEqual('/api/1.0/users/token/' + token);
    });

    it('returns timestamp in milliseconds within 5 seconds value in error body', async () => {
      const nowInMillis = new Date().getTime();
      const fiveSecondsLater = nowInMillis + 5 * 1000;

      await postUser();
      const token = 'invalid-token-value';

      const response = await request(app)
        .post('/api/1.0/users/token/' + token)
        .send();

      expect(response.body.timestamp).toBeLessThan(fiveSecondsLater);
    });
  });
});
