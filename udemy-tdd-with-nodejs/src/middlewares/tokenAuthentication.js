const { verifyToken } = require('../auth/TokenService');

const tokenAuthentication = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (authorization) {
    const token = authorization.substring(7);
    try {
      const user = await verifyToken(token);
      if (user) {
        req.authenticatedUser = user;
      }
      // eslint-disable-next-line no-empty
    } catch (err) {}
  }
  next();
};

module.exports = tokenAuthentication;
