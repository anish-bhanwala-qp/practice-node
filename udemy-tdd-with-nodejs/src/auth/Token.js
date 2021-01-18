const Sequelize = require('sequelize');
const sequelize = require('../config/database');

class Token extends Sequelize.Model {}

Token.init(
  {
    token: {
      type: Sequelize.STRING,
    },
    userId: {
      type: Sequelize.NUMBER,
    },
  },
  {
    sequelize,
    modelName: 'token',
  }
);

module.exports = Token;
