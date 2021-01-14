const express = require('express');
const userService = require('./UserService');
const { check, validationResult } = require('express-validator');
const InvalidTokenException = require('./InvalidTokenException');
const ValidationException = require('../errors/ValidationException');
const pagination = require('../middlewares/pagination');

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
  const pagination = req.pagination;
  const users = await userService.getUsers(
    pagination.page,
    pagination.pageSize
  );
  return res.send(users);
});

module.exports = router;
