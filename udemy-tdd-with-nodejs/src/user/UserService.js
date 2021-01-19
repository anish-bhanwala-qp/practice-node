const User = require('./User');
const bcrypt = require('bcrypt');
const Sequelize = require('sequelize');
const EmailService = require('../email/EmailService');
const EmailException = require('../email/EmailException');
const sequelize = require('../config/database');
const InvalidTokenException = require('./InvalidTokenException');
const { randomString } = require('../shared/generator');
const NotFoundException = require('./NotFoundException');
const FileService = require('../file/FileService');

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
    attributes: ['id', 'username', 'email', 'image'],
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
    attributes: ['id', 'username', 'email', 'image'],
    where: { id: userId, inactive: false },
  });
  if (!user) {
    throw new NotFoundException('user_not_found');
  }

  return user;
};

const updateUser = async (id, updatedBody) => {
  const user = await User.findOne({ where: { id } });
  user.username = updatedBody.username;
  if (user.image && updatedBody.image) {
    await FileService.deleteProfileImage(user.image);
  }
  if (updatedBody.image) {
    const filename = await FileService.saveProfileImage(updatedBody.image);
    user.image = filename;
  }

  await user.save();

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    image: user.image,
  };
};

const deleteUser = async (id) => {
  await User.destroy({ where: { id } });
};

const passwordResetRequest = async (email) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new NotFoundException('email_not_in_use');
  }

  user.passwordResetToken = randomString(16);

  const transaction = await sequelize.transaction();

  await user.save();

  try {
    await EmailService.sendPasswordReset(email, user.passwordResetToken);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw new EmailException();
  }
};

const updatePassword = async (updateRequest) => {
  const user = await User.findOne({
    passwordResetRequest: updateRequest.passwordResetRequest,
  });
  const hash = await bcrypt.hash(updateRequest.password, 10);
  user.password = hash;
  user.passwordResetToken = null;

  await user.save();
};

const findByPasswordResetToken = async (token) => {
  return await User.findOne({
    where: {
      passwordResetToken: token,
    },
  });
};

module.exports = {
  save,
  findByEmail,
  activate,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  passwordResetRequest,
  updatePassword,
  findByPasswordResetToken,
};
