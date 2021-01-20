const app = require('./app');
const sequelize = require('./config/database');
const TokenService = require('./auth/TokenService');

sequelize.sync();

TokenService.scheduleCleanup();

app.listen(4001, () => console.log('Application started!'));
