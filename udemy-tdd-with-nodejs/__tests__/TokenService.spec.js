const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const TokenService = require('../src/auth/TokenService');
const Token = require('../src/auth/Token');

beforeAll(async () => {
  await sequelize.sync();
});

beforeEach(async () => {
  await Token.destroy({ truncate: true });
});

describe(' Scheduled Token Cleanup', () => {
  it('clear the expired token with scheduled task', async () => {
    jest.useFakeTimers();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const token = 'test-token';
    await Token.create({
      token,
      lastUsedAt: eightDaysAgo,
    });

    TokenService.scheduleCleanup();

    jest.advanceTimersByTime(1 * 60 * 60 * 1000 + 5000);
    const tokenInDb = await Token.findOne({ where: { token } });
    expect(tokenInDb).toBeNull();
  });
});
