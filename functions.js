const readFile = require('./index');

async function readConfig() {
    try {
        const data = await readFile('/root/zak/config.cfg', 'utf-8');
        const lines = data.split('\n');
        const config = {};
    
        lines.forEach(line => {
          const [key, value] = line.trim().split('=');
          config[key] = value;
        });
    
        return config;
    } catch (error) {
        console.error('Ошибка при чтении файла конфигурации:', error);
        throw error;
    }
}

module.exports = {
    readConfig
};