const { readConfig } = require('./functions.js');

readConfig().then(config => {
    const bot_token = config.bot_token;
    const bot_password = config.bot_password;
    const data_base_login = config.data_base_login;
    const data_base_password = config.data_base_password;
    const mail_bot_host = config.mail_bot_host;
    const mail_bot_user = config.mail_bot_user;
    const mail_bot_password = config.mail_bot_password;
    const url_manders_1C = config.url_manders_1C;

    module.exports = {
        bot_token,
        bot_password,
        data_base_login,
        data_base_password,
        mail_bot_host,
        mail_bot_user,
        mail_bot_password,
        url_manders_1C
    };
});
