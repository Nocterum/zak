const {Sequelize} = require('sequelize');

module.exports = new Sequelize(
    'tgbotdb',
    'root',
    'root',
    {
        host: '192.168.0.3',
        port: '5432',
        dialect: 'postgres'
    }
)