const RDP = require('rdpjs');

// Создание экземпляра класса RDP
module.exports = {

    clientRDP: RDP.createClient(),

    optionsRDP: {
        address: '185.159.81.174',
        port: '55505',
        username: 'MANDERS\\n_kharitonov',
        password: '1929qweR'
    }
}