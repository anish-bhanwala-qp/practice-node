const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const User = require('../src/user/User');
const bcrypt = require('bcrypt');
const en = require('../locales/en/translation.json');
const hi = require('../locales/hi/translation.json');

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

const putUser = async (id = 5, body = null, options = {}) => {
  let token;
  if (options.auth) {
    const response = await request(app)
      .post(`/api/1.0/auth`)
      .send(options.auth);
    token = response.body.token;
  }

  const agent = request(app).put(`/api/1.0/users/${id}`).send();
  if (options.language) {
    agent.set('accept-language', options.language);
  }
  if (token) {
    agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }

  return agent.send(body);
};

describe('User Update', () => {
  it('returns 403 forbidden when request sent without basic authorization', async () => {
    const response = await putUser();
    expect(response.status).toBe(403);
  });

  it.each`
    language | message
    ${'en'}  | ${en.unauthorized_user_update}
    ${'hi'}  | ${hi.unauthorized_user_update}
  `(
    'returns error body with message "$message" when request is by unauthorized user for laguage "$language"',
    async ({ message, language }) => {
      const nowInMillis = new Date().getTime();
      const response = await putUser(5, null, { language });
      const error = response.body;
      expect(error.message).toBe(message);
      expect(error.path).toBe('/api/1.0/users/5');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it('returns forbidden when request sent with incorrect email in basic authorization', async () => {
    const user = await addUser();

    const response = await putUser(user.id, null, {
      auth: { email: 'wronguser@mail.com', password: 'P4ssword' },
    });

    expect(response.status).toBe(403);
  });

  it('returns forbidden when request sent with incorrect password in basic authorization', async () => {
    const user = await addUser();

    const response = await putUser(user.id, null, {
      auth: { email: 'user1@mail.com', password: 'wrongpassword' },
    });

    expect(response.status).toBe(403);
  });

  it('returns forbidden when update request is sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeUpdated = await addUser({
      ...activeUser,
      username: 'user2',
      email: 'user2@mail.com',
    });

    const response = await putUser(userToBeUpdated.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });

    expect(response.status).toBe(403);
  });

  it('returns forbidden when update request is sent by inactive user with correct credentials but for different user', async () => {
    const inactiveUser = await addUser({ ...activeUser, inactive: true });

    const response = await putUser(inactiveUser.id, null, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });

    expect(response.status).toBe(403);
  });

  it('returns 200 ok when valid request sent from authorized user', async () => {
    const user = await addUser();
    const validUpdate = { username: 'user1-updated' };

    const response = await putUser(user.id, validUpdate, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });

    expect(response.status).toBe(200);
  });

  it('updates username in database when valid update request sent from authorized user', async () => {
    const user = await addUser();
    const validUpdate = { username: 'user1-updated' };

    await putUser(user.id, validUpdate, {
      auth: { email: 'user1@mail.com', password: 'P4ssword' },
    });

    const updatedUserInDb = await User.findOne({ where: { id: user.id } });
    expect(updatedUserInDb.username).toBe(validUpdate.username);
  });

  it('returns 403 when token is not valid', async () => {
    const response = await putUser(5, null, {
      token: 'wrong-token',
    });

    expect(response.status).toBe(403);
  });
});
