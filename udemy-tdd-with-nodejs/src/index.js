const app = require('./app');
const sequelize = require('./config/database');

sequelize.sync({ force: true });

app.listen(4001, () => console.log('Application started!'));
