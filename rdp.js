const RDP = require('rdpjs');

// Создание экземпляра класса RDP


    const clientRDP = RDP.createClient({
        domain: 'MANDERS',
        userName: 'n_kharitonov',
        password: '1929qweR',
        autoLogin : true,
    }).on('connect', function () {
    }).on('close', function() {
    }).on('bitmap', function(bitmap) {
    }).on('error', function(err) {
    }).connect('185.159.81.174', 55505);;

module.exports = {clientRDP, optionsRDP};