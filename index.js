const TelegramApi = require('node-telegram-bot-api');
const token = '6076442091:AAGUxzIT8C7G7_hx4clixZpIi0Adtb2p2MA';
const bot = new TelegramApi(token, {
    polling: {
        interval: 300, //между запросами с клиента на сервер тг "млсек"
        autoStart: true, //обработка всех команд отправленных до запуска программы
        params: {
            timeout:10 //таймаут между запросами "млсек"
        }
    }
});

//импорты
const {gameOptions, againOptions, resetOptions, workOptions, work1Options, VCOptions, brandOptions, startFindOptions, startWorkOptions, mainMenuOptions} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');

//глобальные переменные
chats = {};
lc = {};    //последняя команда
plc = {};   //предпоследняя команда

//меню команд
bot.setMyCommands([
    {command: '/start', description:'Главное меню'},
    {command: '/startwork', description:'Начало работы'},
    {command: '/infowork', description:'Проверка введенных параметров'},
    //{command: '/infogame', description:'Результаты в игре'},
    //{command: '/game', description:'Игра в угадайку'},
])


//функции=========================================================================================

const startGame = async (chatId) => {
    const randomNumber = Math.floor(Math.random() * 10)
    chats[chatId] = randomNumber;
    await bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
}

const editEmail = async (chatId) => {
    lc = '/editEmail'
    return bot.sendMessage(chatId, `Можете ввести Ваш рабочий e-mail:`)
}

const editNickname = async (chatId) => {
    lc = '/editNickname'
    return bot.sendMessage(chatId, `Можете ввести Ваш рабочий e-mail:`)
}

//=============================================================================================================

const start = async () => {
    console.log('Бот запщуен...')

    try {
        await sequelize.authenticate();
        await sequelize.sync();
        await console.log('Подключение к базе данных установленно');
    } catch(err) {
        console.log('Подключение к базе данных сломалось', err);
    }

//слушатель команд======================================================================================
    bot.onText(/\/game/, async msg => {
        const chatId = msg.chat.id;
        const text = msg.text;

        lc = text;
        await bot.sendMessage(chatId, `Сейчас загадаю цифру`)
        const randomNumber = Math.floor(Math.random() * 10)
        chats[chatId] = randomNumber;
        await bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
    })

//слушатель сообщений==========================================================================================
bot.on('message', async msg => {
    const text = msg.text;
    const chatId = msg.chat.id;
    console.log(msg)

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    //старт
        if (text === '/start') {

            try {
                let user = await UserModel.findOne({
                    where: {
                        chatId: chatId
                    }
                });

                //главное меню
                if (user) {
                    lc = null;
                    return bot.sendMessage(chatId, `И снова здравствуй, ${user.nickname}! \n\nНачать работу: /startwork,\nПроверить введенные данные: /infowork,\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`)
                }

                if (!user) {
                    user = await UserModel.create({chatId});
                    console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);

                    await user.update({
                        firstName: msg.from.first_name, 
                        lastName: msg.from.last_name, 
                    });
                    lc = '/editNickname';
                    return bot.sendMessage(chatId, `Привет, ${msg.from.first_name} 'Меня зовут бот Зак.\nПриятно познакомиться!\nЯ могу подсказать наличие товара по поставщику ОПУС, а также узнать сроки поставки и запросить резервирование.\nКак я могу к вам обращаться?`);
                }

            } catch (e) {
            console.log('Ошибка при создании нового пользователя', e);
            }

        }

        //Главное меню
            if (text === '/startwork') {

                if (!user.email) {
                    await bot.sendMessage(chatId, 'Для начала сообщите мне Ваш рабочий e-mail, это потребуется нам в дальнейшем')
                    return editEmail(chatId);
                } else {
                    return bot.sendMessage(chatId, 'И так, с чего начнем?', workOptions)
                } 
            }

            //изменить e-mail
            if (text === '/editEmail') {
                return editEmail(chatId);
            }

            //Записываем e-mail в ячейку БД
            if (lc === '/editEmail') {
                await user.update({email: text});
                return bot.sendMessage(chatId, `Ваш e-mail "<b>${user.email}</b>" успешно сохранён\n<pre>(для перезаписи введите e-mail повторно)</pre>`, startWorkOptions)
            }            

            //изменить Nickname
            if (text === '/editNickname') {
                return editNickname(chatId);
            }
            
            //Записываем Nickname в ячейку БД
            if (lc === '/editNickname') {
                await user.update({nickname: text});
                return bot.sendMessage(chatId, `Хорошо, "<b>${user.nickname}</b>", я запомнил.\n<pre>(для перезаписи введите e-mail повторно)</pre>`, mainMenuOptions)
            }

            //Записываем название бренда в ячейку БД
            if (lc === '/enterBrand') {
                await user.update({brand: text});
                return bot.sendMessage(chatId, `Название бренда "<b>${text}</b>" успешно сохранено\n<pre>(для перезаписи введите бренд повторно)</pre>`, VCOptions);
            }
            
            //Записываем артикул в ячейку БД
            if (lc === '/enterVC') {
                await user.update({vendorCode: text});
                return bot.sendMessage(chatId, `Артикул "<b>${text}</b>" успешно сохранён\n<pre>(для перезаписи введите артикул повторно)</pre>`, startFindOptions);
            }
            
            //вывод информации
            if (text === '/infowork') {
                return bot.sendMessage(chatId, `Вы ищите: \n\n${user.typeFind}\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\n\nВаш email: ${user.email}`);
            }

            if (text === 'recreatetable' && chatId === '356339062') {
                await User.sync({ force: true })
                return bot.sendMessage(chatId, 'Таблица для модели `User` только что была создана заново!')
            }


            if (text.toLowerCase() === 'привет' + '') {
                return bot.sendSticker(chatId, 'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp')
            }

            if (text === '/infogame') {
                const chatId = msg.chat.id;
                const text = msg.text;
    
                lc = text;
                return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions)
            }   

            if (text !== '/game') {
                await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')
                return bot.sendMessage(chatId, 'Не понимаю тебя..')
            }


    })

//слушатель колбэков==========================================================================================================================================

    bot.on('callback_query', async msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id;
        const sorry = 'Извините, эта функция ещё в разработке 😅';
        console.log(msg)

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

        //начало работы
        if(data === '/startwork') {
            lc = null;
            return bot.sendMessage(chatId, 'И так, с чего начнем?', workOptions)
        }
        
        //наличие, сроки, резерв
        if(data === '/work1') {
            lc = data;
            return bot.sendMessage(chatId, 'Хорошо, что мы ищем?', work1Options);
        }

        //запись typeFind
        if(data === 'Текстиль') {
            await user.update ({
                typeFind: data,
            });
            return bot.sendMessage(chatId, `${data}, так и запишем..`, brandOptions);
        }

        //запись typeFind
        if(data === 'Обои') {
            await user.update ({
                typeFind: data,
            });
            return bot.sendMessage(chatId, `${data}, так и запишем..`, brandOptions);
        }

        //Вводим название бренда
        if(data === '/enterBrand') {
            lc = data;
            return bot.sendMessage(chatId, `Введите название бренда:`);
        }

        //вводим артикул
        if(data === '/enterVC') {
            lc = data;
            return bot.sendMessage(chatId, `Введите артикул:`);
        }
        
        //поиск по введенным параметрам: brand, vendorCode, typeFind
        if(data === '/startFind') {
            lc = null;
            return bot.sendMessage(chatId, sorry);
        }

        //превью фото
        if(data === '/work2') {
            lc = null;
            return bot.sendMessage(chatId, sorry);
        }

        //добавить в заказ
        if(data === '/work3') {
            lc = null;
            return bot.sendMessage(chatId, sorry);
        }


        //рестарт игры
        if (data === '/again') {
            lc = data;
            bot.deleteMessage(chatId, {lmId0, lmId1, lmId2});
            return startGame(chatId);
        }

        //рестарт игры
        if (data === '/infogame') {
            lc = null;
            return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions) 
        }

        //сброс результатов игры
        if(data === '/reset') {

            if (user) {
                await user.update ({
                    right: 0,
                    wrong: 0,
                });

            } else {
                await UserModel.create({chatId, right: 0, wrong: 0});
            }
            return bot.sendMessage(chatId, `Результаты игры сброшенны:\nправильных ${user.right},\nнеправильных ${user.wrong}`, againOptions)
        }

        //запись результата игры в БД
        if (lc === '/game' || '/again') {

            if (data == chats[chatId]) {
                user.right += 1;
                await user.save();
                return bot.sendMessage(chatId, `Ты отгадал цифру "${chats[chatId]}"`, againOptions);
            } else {
                user.wrong += 1;
                await user.save();
                return bot.sendMessage(chatId, `Нет, я загадал цифру "${chats[chatId]}"`, againOptions);return
            }
        }

        } catch (err) {
            return bot.sendMessage(chatId, 'Ошибка в исполнении кода прослушивателя колбэков', e);
        }

    })

}

start()

    
