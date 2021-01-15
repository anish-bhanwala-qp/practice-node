const express = require('express');
const bcrypt = require('bcrypt');
const userService = require('../user/UserService');
const AuthenticationException = require('./AuthenticationException');
const ForbiddenException = require('./ForbiddenException');
const { check, validationResult } = require('express-validator');
const authRouter = express.Router();

authRouter.post(
  '/api/1.0/auth',
  check('email').isEmail(),
  check('password').notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AuthenticationException());
    }

    const { email, password } = req.body;
    const user = await userService.findByEmail(email);
    if (!user) {
      return next(new AuthenticationException());
    }

    if (user.inactive) {
      return next(new ForbiddenException());
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return next(new AuthenticationException());
    }

    res.send({ id: user.id, username: user.username });
  }
);

module.exports = authRouter;
