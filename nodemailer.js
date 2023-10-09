
const nodemailer = require('nodemailer');
const fs  = require('fs');

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
console.log(config);

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

    


