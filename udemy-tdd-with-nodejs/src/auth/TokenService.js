const { randomString } = require('../shared/generator');
const Token = require('./Token');
const Sequelize = require('Sequelize');

const ONE_WEEK_IN_MILLIS = 7 * 24 * 60 * 60 * 1000;

const createToken = async (user) => {
  const token = randomString(32);
  await Token.create({ token, userId: user.id, lastUsedAt: new Date() });
  return token;
};

const verifyToken = async (token) => {
  const oneWeekAgo = new Date(Date.now() - ONE_WEEK_IN_MILLIS);
  const tokenInDb = await Token.findOne({
    where: {
      token,
      lastUsedAt: {
        [Sequelize.Op.gt]: oneWeekAgo,
      },
    },
  });

  if (!tokenInDb) {
    return null;
  }

  tokenInDb.lastUsedAt = new Date();
  await tokenInDb.save();

  const userId = tokenInDb.userId;
  return { id: userId };
};

const deleteToken = async (token) => {
  await Token.destroy({ where: { token } });
};

const deleteTokensForUser = async (userId) => {
  await Token.destroy({ where: { userId } });
};

const scheduleCleanup = () => {
  setInterval(async () => {
    const oneWeekAgo = new Date(Date.now() - ONE_WEEK_IN_MILLIS);
    await Token.destroy({
      where: {
        lastUsedAt: {
          [Sequelize.Op.lt]: oneWeekAgo,
        },
      },
    });
  }, 1 * 60 * 60 * 1000);
};

module.exports = {
  createToken,
  verifyToken,
  deleteToken,
  deleteTokensForUser,
  scheduleCleanup,
};
