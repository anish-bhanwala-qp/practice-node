const express = require('express');
const userService = require('./UserService');
const { check, validationResult } = require('express-validator');
const InvalidTokenException = require('./InvalidTokenException');
const ValidationException = require('../errors/ValidationException');
const pagination = require('../middlewares/pagination');
const ForbiddenException = require('../errors/ForbiddenException');
const tokenAuthentication = require('../middlewares/tokenAuthentication');
const router = express.Router();

router.post(
  '/api/1.0/users',
  check('username')
    .notEmpty()
    .withMessage('username_null')
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage('username_size'),
  check('email')
    .notEmpty()
    .withMessage('email_null')
    .bail()
    .isEmail()
    .withMessage('email_valid')
    .bail()
    .custom(async (email) => {
      const user = await userService.findByEmail(email);
      if (user) {
        throw new Error('email_in_use');
      }
    }),
  check('password')
    .notEmpty()
    .withMessage('password_null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('password_size'),
  async (req, res, next) => {
    const errorResult = validationResult(req);
    if (!errorResult.isEmpty()) {
      return next(new ValidationException(errorResult.errors));
    }

    try {
      await userService.save(req.body);
      return res.send({ message: req.t('user_created') });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/api/1.0/users/token/:token', async (req, res, next) => {
  const token = req.params.token;
  try {
    await userService.activate(token);
    return res.send({ message: req.t('account_activation_success') });
  } catch (err) {
    next(new InvalidTokenException());
  }
});

router.get('/api/1.0/users', pagination, async (req, res) => {
  const authenticatedUser = req.authenticatedUser;
  const pagination = req.pagination;
  const users = await userService.getUsers(
    pagination.page,
    pagination.pageSize,
    authenticatedUser
  );
  return res.send(users);
});

router.get('/api/1.0/users/:userId', async (req, res, next) => {
  try {
    const user = await userService.getUser(req.params.userId);
    return res.send(user);
  } catch (err) {
    next(err);
  }
});

router.put('/api/1.0/users/:userId', async (req, res, next) => {
  const authenticatedUser = req.authenticatedUser;
  if (!authenticatedUser || authenticatedUser.id != req.params.userId) {
    return next(new ForbiddenException('unauthorized_user_update'));
  }

  await userService.updateUser(req.params.userId, req.body);

  return res.send();
});

router.delete('/api/1.0/users/:userId', async (req, res, next) => {
  const authenticatedUser = req.authenticatedUser;
  if (!authenticatedUser || authenticatedUser.id != req.params.userId) {
    return next(new ForbiddenException('unauthorized_user_delete'));
  }

  await userService.deleteUser(req.params.userId);

  return res.send();
});

module.exports = router;
