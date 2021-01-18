const User = require('./User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Sequelize = require('sequelize');
const EmailService = require('../email/EmailService');
const EmailException = require('../email/EmailException');
const sequelize = require('../config/database');
const InvalidTokenException = require('./InvalidTokenException');
const UserNotFoundException = require('./UserNotFoundException');
const { randomString } = require('../shared/generator');
const TokenService = require('../auth/TokenService');

const save = async (body) => {
  const { username, password, email } = body;
  const hash = await bcrypt.hash(password, 10);
  const user = {
    username,
    email,
    password: hash,
    activationToken: randomString(16),
  };

  const transaction = await sequelize.transaction();

  await User.create(user, { transaction });

  try {
    await EmailService.sendAccountActivation(email, user.activationToken);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw new EmailException();
  }
};

const findByEmail = async (email) => {
  return await User.findOne({ where: { email } });
};

const activate = async (token) => {
  const user = await User.findOne({ where: { activationToken: token } });
  if (!user) {
    throw new InvalidTokenException();
  }
  user.inactive = false;
  user.activationToken = null;
  await user.save();
};

const getUsers = async (page, pageSize = 10, authenticatedUser = { id: 0 }) => {
  const usersWithCount = await User.findAndCountAll({
    where: {
      inactive: false,
      id: {
        [Sequelize.Op.not]: authenticatedUser.id,
      },
    },
    attributes: ['id', 'username', 'email'],
    limit: pageSize,
    offset: page * pageSize,
  });

  return {
    content: usersWithCount.rows,
    page,
    size: pageSize,
    totalPages: Math.ceil(usersWithCount.count / pageSize),
  };
};

const getUser = async (userId) => {
  const user = await User.findOne({
    attributes: ['id', 'username', 'email'],
    where: { id: userId, inactive: false },
  });
  if (!user) {
    throw new UserNotFoundException();
  }

  return user;
};

const updateUser = async (id, updatedBody) => {
  const user = await User.findOne({ where: { id } });
  user.username = updatedBody.username;

  await user.save();
};

const deleteUser = async (id) => {
  await User.destroy({ where: { id } });
};

module.exports = {
  save,
  findByEmail,
  activate,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
};
