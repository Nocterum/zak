
const nodemailer = require('nodemailer');

module.exports = {
    transporter: nodemailer.createTransport({
        host: 'post.manders.ru',
        auth: {
            user: 'Manders\\n_kharitonov',
            pass: '1929qweR',
        },
        tls: {
            rejectUnauthorized: false
        }
    }),

    recipient: 'nick.of.darkwood@gmail.com',

    //emailAccount: await nodemailer.createTestAccount(),

}

    


