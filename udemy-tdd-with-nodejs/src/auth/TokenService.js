const jwt = require('jsonwebtoken');

const SECRET = 'my-own-secret-value';

const createToken = (user) => {
  return jwt.sign({ id: user.id }, SECRET, { expiresIn: 10 });
};

const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};

module.exports = {
  createToken,
  verifyToken,
};
