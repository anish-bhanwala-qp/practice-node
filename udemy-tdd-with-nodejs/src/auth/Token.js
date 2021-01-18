const Sequelize = require('sequelize');
const sequelize = require('../config/database');

class Token extends Sequelize.Model {}

Token.init(
  {
    token: {
      type: Sequelize.STRING,
    },
    lastUsedAt: {
      type: Sequelize.DATE,
    },
  },
  {
    sequelize,
    modelName: 'token',
    timestamps: false,
  }
);

module.exports = Token;
