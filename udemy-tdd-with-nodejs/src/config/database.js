const Sequelize = require('sequelize');
const config = require('config');

const dbConfig = config.get('database');

const { database, username, password, dialect, storage, logging } = dbConfig;
console.log(dbConfig);
const sequelize = new Sequelize(database, username, password, {
  dialect,
  storage,
  logging,
});

module.exports = sequelize;
