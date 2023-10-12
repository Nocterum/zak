
const nodemailer = require('nodemailer');
const fs  = require('fs');

// прочтение файла config.cfg
function readConfigSync() {
    const data = fs.readFileSync('/root/zak/config.cfg', 'utf-8');
    const lines = data.split('\n');
    const config = {};
  
    lines.forEach(line => {
        const [key, value] = line.trim().split('=');
        config[key] = value;
    });
  
    return config;
}
  
const config = readConfigSync();

module.exports = {

    transporter: nodemailer.createTransport({
        host: config.mail_bot_host,
        auth: {
            user: config.mail_bot_user,
            pass: config.mail_bot_password,
        },
        tls: {
            rejectUnauthorized: false
        }
    }),

}