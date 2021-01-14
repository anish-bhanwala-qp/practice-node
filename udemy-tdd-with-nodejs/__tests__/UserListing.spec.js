const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(() => {
  return User.destroy({ truncate: true });
});

const getUsers = () => {
  return request(app).get('/api/1.0/users').send();
};

const addUsers = async (activeUserCount, inactiveUserCount = 0) => {
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@email.com`,
      inactive: i >= activeUserCount,
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
});
