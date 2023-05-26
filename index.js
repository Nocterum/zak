const TelegramApi = require('node-telegram-bot-api');
const token = '6076442091:AAGUxzIT8C7G7_hx4clixZpIi0Adtb2p2MA';
const bot = new TelegramApi(token, {polling:true});

//импорты
const {gameOptions, againOptions, resetOptions, workOptions, work1Options} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');

//глобальные переменные
chats = {};

//меню команд
bot.setMyCommands([
    {command: '/start', description:'Начальное приветствие'},
    {command: '/startwork', description:'Начало работы'},
    {command: '/infowork', description:'Проверка введенных параметров'},
    {command: '/infogame', description:'Результаты в игре'},
    {command: '/game', description:'Игра в угадайку'},
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
            //старт
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

            //Главное меню
            if (text === '/startwork') {
                return bot.sendMessage(chatId, 'И так, с чего начнем?', workOptions)
            }

            //вывод информации
            if (text === '/info') {
                user.preLastCommand = user.lastCommand;
                user.lastCommand = text;
                return bot.sendMessage(chatId, 
                    `Последняя команда:
                    \n"${user.lastCommand}"
                    \nПредпоследняя команда:
                    \n"${user.preLastCommand}"`);
            }

            //результаты игры
            if (text === '/infogame') {
                user.preLastCommand = user.lastCommand;
                user.lastCommand = text;
                return bot.sendMessage(chatId, 
                    `Правильных ответов: "${user.right}"
                    \nНеправильных ответов: "${user.wrong}"`, resetOptions)   
            }
    
            //функция игры
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

            //Записываем название бренда в ячейку БД
            if(user.lastCommand === '/enterBrand') {
                await user.update({vendorCode: text});
                return bot.sendMessage(chatId, `Название бренда "${text}" успешно сохранено`);
            }
            
            //Записываем артикул в ячейку БД
            if(user.lastCommand === '/enterVC') {
                await user.update({vendorCode: text});
                return bot.sendMessage(chatId, `Артикул "${text}" успешно сохранён`);
            }
            
        } catch (e) {
            return bot.sendMessage(chatId, 
                'Ошибка в исполнении кода слушателя сообщений', e);

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
        });

        try {

        //Наличие, сроки, резерв
        if(data === '/work1') {
            user.preLastCommand = user.lastCommand;
            user.lastCommand = data;
            await user.save();
            return bot.sendMessage(chatId, 'Хорошо, что мы ищем?', work1Options);
        }

        //Вводим название бренда
        if(data === '/enterBrand') {
            user.preLastCommand = user.lastCommand;
            user.lastCommand = data;
            await user.save();
                return bot.sendMessage(chatId, 
                    `Введите название бренда:`);
        }

        //вводим артикул
        if(data === '/enterVC') {
            user.preLastCommand = user.lastCommand;
            user.lastCommand = data;
            await user.save();
            return bot.sendMessage(chatId, 
                `Введите артикул:`);
        }

        if(data === '/work2') {
            return bot.sendMessage(chatId, 'Извините, эта функция ещё в разработке');
        }

        if(data === '/work3') {
            return bot.sendMessage(chatId, 'Извините, эта функция ещё в разработке');
        }

        //рестарт игры
        if (data === '/again') {
            user.preLastCommand = user.lastCommand;
            user.lastCommand = data;
            return startGame(chatId);
        }

        //сброс результатов игры
        if(data === '/reset') {
            user.preLastCommand = user.lastCommand;
            user.lastCommand = data;

            if (user) {
                user.right = 0;
                user.wrong = 0;
            } else {
                await UserModel.create({chatId, right: 0, wrong: 0});
            }
            return bot.sendMessage(chatId, 
                `Результаты игры сброшенны: 
                \nправильных ${user.right}, 
                \nнеправильных ${user.wrong}`, againOptions)
        }

        //запись результата игры в БД
        if (user.lastCommand === '/game' || '/again') {

            if (data == chats[chatId]) {
                user.right += 1;
                return bot.sendMessage(chatId, 
                    `Ты отгадал цифру "${chats[chatId]}"`, againOptions)
            } else {
                user.wrong += 1;
                return bot.sendMessage(chatId, 
                    `Нет, я загадал цифру "${chats[chatId]}"`, againOptions)
            }
        }

        } catch (err) {
            return bot.sendMessage(chatId, 
                'Ошибка в исполнении кода прослушивателя колбэков', e);
        }

        await bot.sendSticker(chatId, 
            'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')

        await user.save();

    })

}

start()

    
