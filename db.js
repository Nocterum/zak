const {Sequelize} = require('sequelize');
const { data_base_login, data_base_password } = require('./index');

module.exports = new Sequelize(
    
    'tgbotdb',
    data_base_login,
    data_base_password,
    // 'root',
    // 'root',
    {
        host: '127.0.0.1',
        port: '5432',
        dialect: 'postgres'
    }
)