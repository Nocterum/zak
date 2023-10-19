const { Sequelize } = require('sequelize');
const fs  = require('fs');

function readConfigSync() {
    const data = fs.readFileSync('/root/zak/config.cfg', 'utf-8');
    // const data = fs.readFileSync('C:\\node.js\\zak\\config.cfg', 'utf-8');
    const lines = data.split('\n');
    const config = {};
  
    lines.forEach(line => {
        const [key, value] = line.trim().split('=');
        config[key] = value;
    });
  
    return config;
}
const config = readConfigSync();

module.exports = new Sequelize(
    
    'tgbotdb',
    config.data_base_login,
    config.data_base_password,
    {
        host: '127.0.0.1',
        port: '5432',
        dialect: 'postgres'
    }
)