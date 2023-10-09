
const nodemailer = require('nodemailer');

module.exports = {

    transporter: nodemailer.createTransport({
        host: 'post.manders.ru',
        auth: {
            user: 'Manders\\zakupki_bot',
            pass: '1244zaazx@%',
        },
        tls: {
            rejectUnauthorized: false
        }
    }),

}

    


