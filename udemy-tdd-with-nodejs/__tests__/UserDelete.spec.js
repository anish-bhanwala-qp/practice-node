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

const auth = async (options = {}) => {
  let token;
  if (options.auth) {
    const response = await request(app)
      .post(`/api/1.0/auth`)
      .send(options.auth);
    token = response.body.token;
  }

  return token;
};

const deleteUser = async (id = 5, options = {}) => {
  const agent = request(app).delete(`/api/1.0/users/${id}`);
  if (options.language) {
    agent.set('accept-language', options.language);
  }

  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }

  return agent.send();
};

describe('User Delete', () => {
  it('returns 403 forbidden when request sent unauthorized', async () => {
    const response = await deleteUser();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'en'}  | ${en.unauthorized_user_delete}
    ${'hi'}  | ${hi.unauthorized_user_delete}
  `(
    'returns error body with message "$message" when request is by unauthorized user for laguage "$language"',
    async ({ message, language }) => {
      const nowInMillis = new Date().getTime();
      const response = await deleteUser(5, { language });
      const error = response.body;
      expect(error.message).toBe(message);
      expect(error.path).toBe('/api/1.0/users/5');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it('returns forbidden when delete request is sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeDeleted = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com',
    });

    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });

    const response = await deleteUser(userToBeDeleted.id, { token });

    expect(response.status).toBe(403);
  });

  it('returns 403 when token is not valid', async () => {
    const response = await deleteUser(5, { token: 'wrong-token' });

    expect(response.status).toBe(403);
  });

  it('returns 200 ok when valid request sent from authorized user', async () => {
    const user = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });

    const response = await deleteUser(user.id, { token });

    expect(response.status).toBe(200);
  });

  it('deletes user in database when valid delete request sent from authorized user', async () => {
    const user = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });

    await deleteUser(user.id, { token });

    const deletedUserInDb = await User.findOne({ where: { id: user.id } });
    expect(deletedUserInDb).toBeNull();
  });

  it('deletes token from database when delete when valid delete request sent from authorized user', async () => {
    const user = await addUser();
    const token = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    await deleteUser(user.id, { token });

    const tokenInDb = await Token.findOne({ where: { token } });
    expect(tokenInDb).toBeNull();
  });

  it('deletes all tokens from database when delete when valid delete request sent from authorized user', async () => {
    const user = await addUser();
    const token1 = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    const token2 = await auth({
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });
    await deleteUser(user.id, { token: token1 });

    const tokenInDb = await Token.findOne({ where: { token: token2 } });
    expect(tokenInDb).toBeNull();
  });
});
