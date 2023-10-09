
const nodemailer = require('nodemailer');
const { mail_bot_host, mail_bot_user, mail_bot_password } = require('./index');

module.exports = {

    transporter: nodemailer.createTransport({
        // host: 'post.manders.ru',
        host: `${mail_bot_host}`,
        auth: {
            // user: 'Manders\\zakupki_bot',
            user: `${mail_bot_user}`,
            // pass: '1244zaazx@%',
            pass: `${mail_bot_password}`,
        },
        tls: {
            rejectUnauthorized: false
        }
    }),

}

    


