// const fs = require('fs');

// const config = {};
// fs.readFileSync('/root/zak/config.cfg', 'utf-8').split('\n').forEach(line => {
//     const [key, value] = line.trim().split('=');
//     config[key] = value;
// });

// const util = require('util');
// const readFile = util.promisify(fs.readFile);

// async function readConfig() {
    
//     try {
//         const data = await readFile('/root/zak/config.cfg', 'utf-8');
//         const lines = data.split('\n');
//     const config = {};
    
//     lines.forEach(line => {
//         const [key, value] = line.trim().split('=');
//         config[key] = value;
//     });
    
//     return config;
// } catch (error) {
//     console.error('Ошибка при чтении файла конфигурации:', error);
//     throw error;
// }
// }



// module.exports = readConfig();