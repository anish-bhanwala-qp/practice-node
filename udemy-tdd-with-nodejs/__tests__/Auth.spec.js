const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const User = require('../src/user/User');
const bcrypt = require('bcrypt');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({ truncate: true });
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

const postAuthentication = (credentials) => {
  return request(app).post('/api/1.0/auth').send(credentials);
};

describe('Authentication', () => {
  it('returns 200 when credentials are correct', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword',
    });

    expect(response.status).toBe(200);
  });

  it('returns id and username when credentials are correct', async () => {
    const user = await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword',
    });

    const body = response.body;
    expect(body.id).toBe(user.id);
    expect(body.username).toBe(user.username);
    expect(Object.keys(body)).toEqual(['id', 'username']);
  });

  it('returns 401 when user does not exist', async () => {
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword',
    });

    expect(response.status).toBe(401);
  });

  it('returns proper error body when authentication fails', async () => {
    const nowInMillis = new Date().getTime();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword',
    });

    const error = response.body;

    expect(error.path).toBe('/api/1.0/auth');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it.each`
    language | message
    ${'hi'}  | ${'गलत परिचय'}
    ${'en'}  | ${'Incorrect credentials'}
  `(
    'returns "$message" for language "$language" when incorrect credentials',
    async ({ language, message }) => {
      const response = await postAuthentication({
        email: 'user1@mail.com',
        password: 'P4ssword',
      }).set('accept-language', language);

      expect(response.body.message).toBe(message);
    }
  );

  it('returns 401 when password is wrong', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword-diff',
    });

    expect(response.status).toBe(401);
  });

  it('returns 403 when logging in with an inactive account', async () => {
    await addUser({ ...activeUser, inactive: true });
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword',
    });

    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'hi'}  | ${'खाता निष्क्रिय है'}
    ${'en'}  | ${'Account is inactive'}
  `(
    'returns "$message" for language "$language" when authentication fails for inactive account',
    async ({ language, message }) => {
      await addUser({ ...activeUser, inactive: true });
      const response = await postAuthentication({
        email: 'user1@mail.com',
        password: 'P4ssword',
      }).set('accept-language', language);

      expect(response.body.message).toBe(message);
    }
  );

  it('returns 401 when email is not valid', async () => {
    const response = await postAuthentication({
      password: 'P4ssword',
    });

    expect(response.status).toBe(401);
  });

  it('returns 401 when password is not valid', async () => {
    const response = await postAuthentication({
      email: 'user1@mail.com',
    });

    expect(response.status).toBe(401);
  });
});
