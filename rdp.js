const rdp = require('node-rdp');

rdp({
    address: '185.159.81.174:55505',
    username: 'MANDERS\n_kharitonov',
    password: '1929qweR'
  }).then(function() {
    console.log('Соединение с удалённым рабочим столом не состоялось');
  });

  module.exports = rdp;