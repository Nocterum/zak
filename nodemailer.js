
const nodemailer = require('nodemailer');

module.exports = {
    transporter: nodemailer.createTransport({
        host: 'post.manders.ru',
        auth: {
            user: 'Manders\\zakupki_bot',
            pass: '1234qWER',
        },
        tls: {
            rejectUnauthorized: false
        }
    }),

    recipient: 'nick.of.darkwood@gmail.com',

}

    


