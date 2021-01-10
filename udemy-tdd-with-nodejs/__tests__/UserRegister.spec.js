const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(() => {
  return sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
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

  const username_null = 'Username cannot be null';
  const username_size =
    'Username character length must be between 4 to 32 characters';
  const email_null = 'Email cannot be null';
  const email_valid = 'Email is not valid';
  const password_null = 'Password cannot be null';
  const password_size = 'Password must be at least 6 characters';

  it.each`
    field         | value               | errorMessage
    ${'username'} | ${null}             | ${username_null}
    ${'username'} | ${'use'}            | ${username_size}
    ${'username'} | ${'u'.repeat(33)}   | ${username_size}
    ${'email'}    | ${null}             | ${email_null}
    ${'email'}    | ${'invaldEmail'}    | ${email_valid}
    ${'email'}    | ${'user.email.com'} | ${email_valid}
    ${'email'}    | ${'user@email'}     | ${email_valid}
    ${'password'} | ${null}             | ${password_null}
    ${'password'} | ${'12345'}          | ${password_size}
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
});

describe('Internationalization', () => {
  const username_null = 'उपयोगकर्ता नाम शून्य नहीं हो सकता';
  const username_size =
    'उपयोगकर्ता नाम वर्ण की लंबाई 4 से 32 वर्णों के बीच होनी चाहिए';
  const email_null = 'ईमेल शून्य नहीं हो सकता';
  const email_valid = 'ईमेल शून्य नहीं हो सकता';
  const password_null = 'पासवर्ड शून्य नहीं हो सकता';
  const password_size = 'पासवर्ड कम से कम 6 अंकों का होना चाहिए';

  it.each`
    field         | value               | errorMessage
    ${'username'} | ${null}             | ${username_null}
    ${'username'} | ${'use'}            | ${username_size}
    ${'username'} | ${'u'.repeat(33)}   | ${username_size}
    ${'email'}    | ${null}             | ${email_null}
    ${'email'}    | ${'invaldEmail'}    | ${email_valid}
    ${'email'}    | ${'user.email.com'} | ${email_valid}
    ${'email'}    | ${'user@email'}     | ${email_valid}
    ${'password'} | ${null}             | ${password_null}
    ${'password'} | ${'12345'}          | ${password_size}
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

  const email_in_use = 'ईमेल पहले से उपयोग में है';

  it(`returns "${email_in_use}" when same email is already in use when language is HINDI`, async () => {
    await User.create({ ...validUser });
    const response = await postUser({ ...validUser }, { language: 'hi' });

    const body = response.body;
    expect(body.validationErrors.email).toBe(email_in_use);
  });

  const user_created = 'उपयोगकर्ता बनाया गया';
  it('returns success message when signup request is valid', async () => {
    const response = await postUser({ ...validUser }, { language: 'hi' });
    expect(response.body.message).toBe(user_created);
  });
});
