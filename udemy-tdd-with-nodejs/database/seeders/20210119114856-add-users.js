'use strict';
const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('P4ssword', 10);
    const users = [];
    for (let i = 0; i < 25; i++) {
      users.push({
        username: `user${i + 1}`,
        email: `user${i + 1}@email.com`,
        password: hashedPassword,
        inactive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await queryInterface.bulkInsert('users', users, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', null, {});
  },
};
