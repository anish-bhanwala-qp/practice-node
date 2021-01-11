const express = require('express');
const userService = require('./UserService');
const router = express.Router();
const { check, validationResult } = require('express-validator');

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
  async (req, res) => {
    const errorResult = validationResult(req);
    if (!errorResult.isEmpty()) {
      const validationErrors = {};
      errorResult.errors.forEach((error) => {
        validationErrors[error.param] = req.t(error.msg);
      });
      return res.status(400).send({ validationErrors: validationErrors });
    }

    try {
      await userService.save(req.body);
      return res.send({ message: req.t('user_created') });
    } catch (err) {
      return res.status(502).send({ message: req.t(err.message) });
    }
  }
);

router.post('/api/1.0/users/token/:token', async (req, res) => {
  const token = req.params.token;
  try {
    await userService.activate(token);
    return res.send({ message: req.t('account_activation_success') });
  } catch (err) {
    return res.status(400).send({ message: req.t(err.message) });
  }
});

module.exports = router;
