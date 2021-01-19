const app = require('./app');
const sequelize = require('./config/database');
const User = require('./user/User');
const bcrypt = require('bcrypt');
const TokenService = require('./auth/TokenService');

sequelize.sync();

TokenService.scheduleCleanup();

app.listen(4001, () => console.log('Application started!'));
