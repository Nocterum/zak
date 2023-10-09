const fs = require('./index');

const config = {};
fs.readFileSync('config.cfg', 'utf-8').split('\n').forEach(line => {
    const [key, value] = line.trim().split('=');
    config[key] = value;
});

const token = config['bot_token'];
const bot_password = config['bot_password'];
const data_base_login = config['data_base_login'];
const data_base_password = config['data_base_password'];
const mail_bot_host = config['mail_bot_host'];
const mail_bot_user = config['mail_bot_user'];
const mail_bot_password = config['mail_bot_password'];
const url_manders_1C = config['url_manders_1C'];
