const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const User = require('../src/user/User');
const bcrypt = require('bcrypt');
const en = require('../locales/en/translation.json');
const hi = require('../locales/hi/translation.json');
const Token = require('../src/auth/Token');

beforeAll(async () => {
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync();
  }
});

beforeEach(async () => {
  await User.destroy({
    truncate: {
      cascade: true,
    },
  });
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
const putUser = async (id = 5, body = null, options = {}) => {
  const agent = request(app).put(`/api/1.0/users/${id}`).send();
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }

  return agent.send(body);
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

  it('returns id, username, and token when credentials are correct', async () => {
    const user = await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword',
    });

    const body = response.body;
    expect(body.id).toBe(user.id);
    expect(body.username).toBe(user.username);
    expect(Object.keys(body)).toEqual(['id', 'username', 'token', 'image']);
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
    ${'hi'}  | ${hi.authentication_failure}
    ${'en'}  | ${en.authentication_failure}
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
    ${'hi'}  | ${hi.inactive_authentication_failure}
    ${'en'}  | ${en.inactive_authentication_failure}
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

  it('returns token in response body when credentials are correct', async () => {
    await addUser();
    const response = await postAuthentication({
      email: 'user1@mail.com',
      password: 'P4ssword',
    });

    expect(response.body.token).not.toBeUndefined();
  });
});

const postLogout = (options = {}) => {
  const agent = request(app).post('/api/1.0/logout');
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }

  return agent.send();
};

describe('Logout', () => {
  it('returns 200 ok when unauthorized request sent for logout', async () => {
    const response = await postLogout();
    expect(response.status).toBe(200);
  });

  it('removes the token from database', async () => {
    await addUser();
    const response = await postAuthentication({
      email: activeUser.email,
      password: activeUser.password,
    });

    const token = response.body.token;
    await postLogout({ token });

    const storedToken = await Token.findOne({ where: { token } });

    expect(storedToken).toBeNull();
  });
});

describe('Token Expiration', () => {
  it('returns 403 when token is older than one week', async () => {
    const savedUser = await addUser();

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1);
    const token = 'test-token';
    await Token.create({
      token,
      userId: savedUser.id,
      lastUsedAt: oneWeekAgo,
    });

    const validUpdate = { username: 'user1-updated' };
    const response = await putUser(savedUser.id, validUpdate, { token });

    expect(response.status).toBe(403);
  });

  it('refreshes lastUsedAt when unexpired token is used', async () => {
    const savedUser = await addUser();

    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 - 1);
    const token = 'test-token';
    await Token.create({
      token,
      userId: savedUser.id,
      lastUsedAt: fourDaysAgo,
    });

    const rightBeforeSendingRequest = new Date();
    const validUpdate = { username: 'user1-updated' };
    await putUser(savedUser.id, validUpdate, { token });

    const tokenInDb = await Token.findOne({ where: { token } });

    expect(tokenInDb.lastUsedAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });

  it('refreshes lastUsedAt when unexpired token is used for unauthenticated end-point', async () => {
    const savedUser = await addUser();

    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 - 1);
    const token = 'test-token';
    await Token.create({
      token,
      userId: savedUser.id,
      lastUsedAt: fourDaysAgo,
    });

    const rightBeforeSendingRequest = new Date();
    await request(app)
      .get(`/api/1.0/users/${savedUser.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    const tokenInDb = await Token.findOne({ where: { token } });

    expect(tokenInDb.lastUsedAt.getTime()).toBeGreaterThan(
      rightBeforeSendingRequest.getTime()
    );
  });
});
