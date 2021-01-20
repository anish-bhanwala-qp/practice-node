const app = require('./app');
const sequelize = require('./config/database');
const TokenService = require('./auth/TokenService');
const logger = require('./shared/logger');

sequelize.sync();

TokenService.scheduleCleanup();

const appVersion = process.env.npm_package_version;

app.listen(4001, () =>
  logger.info('Application started (version: ' + appVersion + ')')
);
