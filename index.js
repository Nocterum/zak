const TelegramApi = require('node-telegram-bot-api');
const token = '6076442091:AAGUxzIT8C7G7_hx4clixZpIi0Adtb2p2MA';
const bot = new TelegramApi(token, {polling:true});

//импорты
const {gameOptions, againOptions, resetOptions} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');

//глобальные переменные
chats = {};

//меню
bot.setMyCommands([
    {command: '/startwork', description:'Начало работы'},
    {command: '/start', description:'Начальное приветствие'},
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

const start = async () => {

    try {
        await sequelize.authenticate()
        await sequelize.sync()
        await console.log('Подключение к БД установленно');
    } catch(err) {
        console.log('Подключение к БД сломалось', err)
    }

    //слушатель сообщений
    bot.on('message', async msg => {
        const text = msg.text;
        const chatId = msg.chat.id;
        console.log(msg)

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            try {
                if (text === '/start') {

                    if (user) {
                        user.preLastCommand = user.lastCommand;
                        user.lastCommand = text;
                        return bot.sendMessage(chatId, 
                            `Привет, ${msg.from.first_name}. Меня зовут бот Зак. 
                            \nЯ могу подсказать наличие товара по поставщику ОПУС, а так же узнать сроки поставки и запросить резервирование.
                            \nЧтобы начать работу выбери в меню команду /startwork.`)
                    } else {
                        user.preLastCommand = user.lastCommand;
                        user.lastCommand = text;
                        console.log('Новый пользователь создан:', user);
                        return bot.sendMessage(chatId, 
                            `Привет, ${msg.from.first_name}. Меня зовут бот Зак.
                            Приятно познакомиться! Я успешно внёс ваш id"${chatId}" в свою базу данных. 
                            \nЯ могу подсказать наличие товара по поставщику ОПУС, а так же узнать сроки поставки и запросить резервирование.
                            \nЧтобы начать работу выбери в меню команду /startwork `)
                    }
                    
                }

            } catch (e) {
                console.log('Ошибка при создании нового пользователя', e);
            }

    
            if (text === '/info') {
                user.preLastCommand = user.lastCommand;
                user.lastCommand = text;
                return bot.sendMessage(chatId, 
                    `Последняя введеная команда "Команда"`)
            }

            if (text === '/infogame') {
                user.preLastCommand = user.lastCommand;
                user.lastCommand = text;
                return bot.sendMessage(chatId, 
                    `Правильных ответов: "${user.right}"
                    \nНеправильных ответов: "${user.wrong}"
                    \nПоследняя команда:
                    \n"${user.lastCommand}"
                    \nПредпоследняя команда:
                    \n"${user.preLastCommand}"`, resetOptions);   
            }
    
            if (text === '/game') {
                user.preLastCommand = user.lastCommand;
                user.lastCommand = text;
                await bot.sendMessage(chatId, 
                    `Сейчас загадаю цифру`)
                const randomNumber = Math.floor(Math.random() * 10)
                chats[chatId] = randomNumber;
                return bot.sendMessage(chatId, 
                    `Отгадывай:`, gameOptions)
            }
    
        } catch (e) {
            return bot.sendMessage(chatId, 
                'Ошибка в исполнении кода', e);

        }

        await user.save();

        await bot.sendSticker(chatId, 
            'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')
        return bot.sendMessage(chatId, 
            'Не понимаю тебя..')

    })

//слушатель колбэков-------------------------------------------------------------------------------------------------------------------------------------

    bot.on('callback_query', async msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id;
        console.log(msg)

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        })

        if (data === '/again') {
            user.preLastCommand = user.lastCommand;
            user.lastCommand = data;
            await user.save();
            return startGame(chatId);
        }

        if(data === '/reset') {
            user.preLastCommand = user.lastCommand;
            user.lastCommand = data;
            await user.save();

            if (user) {
                user.right = 0;
                user.wrong = 0;
                await user.save();
            } else {
                await UserModel.create({chatId, right: 0, wrong: 0});
            }
            return bot.sendMessage(chatId, 
                `Результаты игры сброшенны: 
                \nправильных ${user.right}, 
                \nнеправильных ${user.wrong}`, againOptions)
        }

        if (user.lastCommand === '/game' || '/again') {

            if (data == chats[chatId]) {
                user.right += 1;
                await user.save();
                return bot.sendMessage(chatId, 
                    `Ты отгадал цифру "${chats[chatId]}"`, againOptions)
            } else {
                user.wrong += 1;
                await user.save();
                return bot.sendMessage(chatId, 
                    `Нет, я загадал цифру "${chats[chatId]}"`, againOptions)
            }
        } else {
        }

        await bot.sendSticker(chatId, 
            'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')

        await user.save();

    })


}

start()

    
