const Sequelize = require('sequelize');
const Token = require('../auth/Token');
const sequelize = require('../config/database');

class User extends Sequelize.Model {}

User.init(
  {
    username: {
      type: Sequelize.STRING,
    },
    email: {
      type: Sequelize.STRING,
      unique: true,
    },
    password: {
      type: Sequelize.STRING,
    },
    inactive: {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    },
    activationToken: {
      type: Sequelize.STRING,
    },
  },
  {
    sequelize,
    modelName: 'user',
  }
);

User.hasMany(Token, {
  onDelete: 'cascade',
  foreignKey: 'userId',
});

module.exports = User;
