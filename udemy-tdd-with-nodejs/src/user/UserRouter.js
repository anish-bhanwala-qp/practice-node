const express = require('express');
const userService = require('./UserService');
const { check, validationResult } = require('express-validator');
const InvalidTokenException = require('./InvalidTokenException');
const ValidationException = require('../errors/ValidationException');
const pagination = require('../middlewares/pagination');
const ForbiddenException = require('../errors/ForbiddenException');
const User = require('./User');
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

router.put(
  '/api/1.0/users/:userId',
  check('image').custom((imageBase64String) => {
    if (!imageBase64String) {
      return true;
    }
    const buffer = Buffer.from(imageBase64String, 'base64');
    if (buffer.length > 1024 * 1024 * 2) {
      throw new Error();
    }
    return true;
  }),
  async (req, res, next) => {
    const errorResult = validationResult(req);
    if (!errorResult.isEmpty()) {
      return next(new ValidationException(errorResult.errors));
    }

    const authenticatedUser = req.authenticatedUser;
    if (!authenticatedUser || authenticatedUser.id != req.params.userId) {
      return next(new ForbiddenException('unauthorized_user_update'));
    }

    const updatedUser = await userService.updateUser(
      req.params.userId,
      req.body
    );

    return res.send(updatedUser);
  }
);

router.delete('/api/1.0/users/:userId', async (req, res, next) => {
  const authenticatedUser = req.authenticatedUser;
  if (!authenticatedUser || authenticatedUser.id != req.params.userId) {
    return next(new ForbiddenException('unauthorized_user_delete'));
  }

  await userService.deleteUser(req.params.userId);

  return res.send();
});

router.post(
  '/api/1.0/user/password',
  check('email').notEmpty().withMessage('email_valid'),
  async (req, res, next) => {
    const errorResult = validationResult(req);
    if (!errorResult.isEmpty()) {
      return next(new ValidationException(errorResult.errors));
    }

    try {
      await userService.passwordResetRequest(req.body.email);
      return res.send({ message: req.t('password_reset_success') });
    } catch (err) {
      next(err);
    }
  }
);

const passwordResetTokenValidator = async (req, res, next) => {
  const user = await userService.findByPasswordResetToken(
    req.body.passwordResetToken || ''
  );

  if (!user) {
    return next(new ForbiddenException('unauthorized_password_reset'));
  }
  next();
};

router.put(
  '/api/1.0/user/password',
  passwordResetTokenValidator,
  check('password')
    .notEmpty()
    .withMessage('password_null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('password_size'),
  async (req, res, next) => {
    const errorResult = validationResult(req);
    if (!errorResult.isEmpty()) {
      return res.status(400).send();
    }

    await userService.updatePassword(req.body);
    res.send();
  }
);

module.exports = router;
