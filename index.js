const TelegramApi = require('node-telegram-bot-api');
const token = '6076442091:AAGUxzIT8C7G7_hx4clixZpIi0Adtb2p2MA'
const bot = new TelegramApi(token, {polling:true})

//импорты
const {gameOptions, againOptions} = require('./options')

//глобальные переменные
chats = {};

//меню
bot.setMyCommands([
    {command: '/startwork', description:'Начало работы'},
    {command: '/start', description:'Начальное'},
    {command: '/infowork', description:'Проверка введенных параметров'},
    {command: '/game', description:'Игра в угадайку'},
    {command: '/infogame', description:'Результаты в игре'},
])



const startGame = async (chatId) => {
        const randomNumber = Math.floor(Math.random() * 10)
        chats[chatId] = randomNumber;
        await bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
    }

//-------------------------------------------------------------------------------------------------------------------------------------

const start = () => {

    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        console.log(msg)

        if (text === '/start') {
            return bot.sendMessage(chatId, `Привет, ${msg.from.first_name}, меня зовут бот Зак. 
            \nЯ могу подсказать наличие товара по поставщику ОПУС, а так же узнать сроки поставки и запросить резервирование.
            \nЧтобы начать работу выбери в меню команду /startwork.`)
        }

        if (text === '/info') {
            return bot.sendMessage(chatId, `Последняя введеная команда "Команда"`)
        }

        if (text === '/game') {
            await bot.sendMessage(chatId, `Сейчас загадаю цифру`)
            const randomNumber = Math.floor(Math.random() * 10)
            chats[chatId] = randomNumber;
            return bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
        }

        await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')
        return bot.sendMessage(chatId, 'Не понимаю тебя..')

    })

//-------------------------------------------------------------------------------------------------------------------------------------

    bot.on('callback_query', async msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id;
        console.log(msg)

        if (data === '/again') {
            return startGame(chatId)
        }

        if (data === chats[chatId]) {
            return bot.sendMessage(chatId, `Ты отгадал цифру "${chats[chatId]}"`, againOptions)
        } else {
            return bot.sendMessage(chatId, `Нет, я загадал цифру "${chats[chatId]}"`, againOptions)
        }
    })
}

start()

    
