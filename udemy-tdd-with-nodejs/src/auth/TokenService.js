const { randomString } = require('../shared/generator');
const Token = require('./Token');

const createToken = async (user) => {
  const token = randomString(32);
  await Token.create({ token, userId: user.id });
  return token;
};

const verifyToken = async (token) => {
  const tokenInDb = await Token.findOne({ where: { token } });
  const userId = tokenInDb.userId;
  return { id: userId };
};

const deleteToken = async (token) => {
  await Token.destroy({ where: { token } });
};

module.exports = {
  createToken,
  verifyToken,
  deleteToken,
};
