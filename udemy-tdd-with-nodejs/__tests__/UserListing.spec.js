const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const en = require('../locales/en/translation.json');
const hi = require('../locales/hi/translation.json');
const bcrypt = require('bcrypt');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await User.destroy({
    truncate: {
      cascade: true,
    },
  });
});

const getUsers = (options = {}) => {
  const agent = request(app).get('/api/1.0/users');
  if (options.auth) {
    const { email, password } = options.auth;
    agent.auth(email, password);
  }
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }

  return agent.send();
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

const addUsers = async (activeUserCount, inactiveUserCount = 0) => {
  const hashedPassword = await bcrypt.hash('P4ssword', 10);
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@email.com`,
      inactive: i >= activeUserCount,
      password: hashedPassword,
    });
  }
};

describe('Listing for users', () => {
  it('returns 200 ok when there are no user in database', async () => {
    const response = await getUsers();
    expect(response.status).toBe(200);
  });

  it('returns page object as response body', async () => {
    const response = await getUsers();
    expect(response.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 users when there are 11 users in the database', async () => {
    await addUsers(11);
    const response = await getUsers();
    expect(response.body.content.length).toEqual(10);
  });

  it('returns 6 users in page content when there are 6 active users and 5 inacive users', async () => {
    await addUsers(6, 5);
    const response = await getUsers();
    expect(response.body.content.length).toEqual(6);
  });

  it('returns only id, username, and email in content array for each user', async () => {
    await addUsers(11);
    const response = await getUsers();
    const user = response.body.content[0];
    expect(Object.keys(user)).toEqual(['id', 'username', 'email']);
  });

  it('returns 2 as totalPages when there are 15 active and 7 inactive users in the database', async () => {
    await addUsers(15, 7);
    const response = await getUsers();
    expect(response.body.totalPages).toEqual(2);
  });

  it('returns 2nd page users and page indicator when page is set as 1 in request parameter', async () => {
    await addUsers(11);
    const response = await getUsers().query({ page: 1 });

    expect(response.body.content[0].username).toBe('user11');
    expect(response.body.page).toBe(1);
  });

  it('returns first page when page is set below 0', async () => {
    await addUsers(11);
    const response = await getUsers().query({ page: -1 });

    expect(response.body.page).toBe(0);
  });

  it('returns 5 users and corresponding page indicator when page size is set as 5 in request', async () => {
    await addUsers(11);
    const response = await getUsers().query({ pageSize: 5 });

    expect(response.body.content.length).toBe(5);
    expect(response.body.size).toBe(5);
  });

  it('returns 10 users and corresponding size indicator when size is set as 1000', async () => {
    await addUsers(11);
    const response = await getUsers().query({ pageSize: 1000 });

    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('returns 10 users and corresponding size indicator when size is set as 0', async () => {
    await addUsers(11);
    const response = await getUsers().query({ pageSize: 0 });

    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('returns page as zero and size as 10 when non numeric query params are passed in request', async () => {
    await addUsers(11);
    const response = await getUsers().query({ pageSize: 'size', page: 'page' });

    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('returns user list without logged in user when request has valid authorization header', async () => {
    await addUsers(11);
    const token = await auth({
      auth: { email: 'user1@email.com', password: 'P4ssword' },
    });
    const response = await getUsers({ token }).query({
      pageSize: 'size',
      page: 'page',
    });

    expect(response.body.totalPages).toBe(1);
  });
});

describe('Get user', () => {
  const getUser = (id = 5) => {
    return request(app).get(`/api/1.0/users/${id}`).send();
  };

  it('returns 404 when user not found', async () => {
    const response = await request(app).get('/api/1.0/users/5').send();
    expect(response.status).toBe(404);
  });

  it.each`
    language | message
    ${'en'}  | ${en.user_not_found}
    ${'hi'}  | ${hi.user_not_found}
  `(
    'returns $message for unknown user when language is set to $language',
    async ({ language, message }) => {
      const response = await getUser().set('accept-language', language);
      expect(response.body.message).toBe(message);
    }
  );

  it('returns proper error bopdy when user not found', async () => {
    const nowInMillis = new Date().getTime();
    const response = await getUser();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/users/5');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it('returns 200 when user exists in database', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@email.com',
      inactive: false,
    });
    const response = await getUser(user.id);
    expect(response.status).toBe(200);
  });

  it('returns id, username, and email when user exists in database', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@email.com',
      inactive: false,
    });
    const response = await getUser(user.id);
    expect(Object.keys(response.body)).toEqual(['id', 'username', 'email']);
  });

  it('returns 404 when user is inactive in database', async () => {
    const user = await User.create({
      username: 'user1',
      email: 'user1@email.com',
      inactive: true,
    });
    const response = await getUser(user.id);
    expect(response.status).toBe(404);
  });
});
