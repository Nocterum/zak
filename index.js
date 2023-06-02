const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
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
const {gameOptions, againOptions, resetOptions, workOptions, work1Options, VCOptions, brandOptions, startFindOptions, begintWorkOptions, mainMenuOptions} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');

//глобальные переменные
chats = {};
lc = {};    //последняя команда
plc = {};   //предпоследняя команда
botMsgIdx = {};    //айди последнего сообщения от бота


//меню команд
bot.setMyCommands([
    {command: '/mainmenu', description:'Главное меню'},
    {command: '/beginwork', description:'Начало работы'},
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
    return bot.sendMessage(chatId, `Можете ввести Ваш никнейм:`)
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

//старт
bot.onText(/\/start/, async msg => {
    const chatId = msg.chat.id;

    await bot.deleteMessage(chatId, msg.message_id);
    try {
        let user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        //главное меню
        if (user) {
            lc = null;
            return bot.sendMessage(chatId, `И снова здравствуйте, ${user.nickname}!\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`)
        } else {
            user = await UserModel.create({chatId});
            console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);
             await user.update({
                firstName: msg.from.first_name, 
                lastName: msg.from.last_name, 
            });

            lc = '/editNickname';
            await bot.sendMessage(chatId, '(´｡• ◡ •｡`) ')
            return bot.sendMessage(chatId, `Приветcтвую, ${msg.from.first_name}! Меня зовут бот Зак.\nПриятно познакомиться!\nЯ могу подсказать наличие товара по поставщику ОПУС, а также узнать сроки поставки и запросить резервирование.\nКак я могу к вам обращаться?`);
        }  
     } catch (e) {
    console.log('Ошибка при создании нового пользователя', e);
    }

},

bot.onText(/\/game/, async msg => {
    const chatId = msg.chat.id;

    await bot.deleteMessage(chatId, msg.message_id);
        lc = '/game';
        await bot.sendMessage(chatId, `Игра "угадай число"`)
        const randomNumber = Math.floor(Math.random() * 10)
        chats[chatId] = randomNumber;
        return bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
            .then((sentMsg) => {
                message1Id = sentMsg.message_id;
                console.log(sentMsg);
            })
    }),

bot.onText(/\/infogame/, async msg => {
    const chatId = msg.chat.id;

    await bot.deleteMessage(chatId, msg.message_id);
        lc = null;
        return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions)
    }) 
)


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

    //главное меню
    if (text === '/mainmenu') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));

        if (user) {
            lc = null;
            return bot.sendMessage(chatId, `И снова здравствуйте, ${user.nickname}!\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`)
            }
        }

    //начало работы
    if (text === '/beginwork') {

        if (msg && msg.message_id) {
            await bot.deleteMessage(chatId, msg.message_id);
            await bot.deleteMessage(chatId, (msg.message_id -= 1));
        }

        if (!user.email) {
            return editEmail(chatId);
        } else {
            return bot.sendMessage(chatId, 'И так, с чего начнем?', workOptions)
        } 
    }

    //изменить e-mail
    if (text === '/editEmail') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        return editEmail(chatId);
    }

    //Записываем e-mail в ячейку БД
    if (lc === '/editEmail') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        await user.update({email: text});
        return bot.sendMessage(chatId, `Ваш e-mail "<b>${user.email}</b>" успешно сохранён\n<pre>(для перезаписи введите e-mail повторно)</pre>`, begintWorkOptions)
    }            

    //изменить Nickname
    if (text === '/editNickname') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        return editNickname(chatId);
    }
    
    //Записываем Nickname в ячейку БД
    if (lc === '/editNickname') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        await user.update({nickname: text});
        return bot.sendMessage(chatId, `Хорошо, "<b>${user.nickname}</b>", я запомню.\n<pre>(для перезаписи введите никнейм повторно)</pre>`, mainMenuOptions)
    }

    //Записываем название бренда в ячейку БД
    if (lc === '/enterBrand') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        await user.update({brand: text});
        return bot.sendMessage(chatId, `Название бренда "<b>${text}</b>" успешно сохранено\n<pre>(для перезаписи введите бренд повторно)</pre>`, VCOptions);
    }
    
    //Записываем артикул в ячейку БД
    if (lc === '/enterVC') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        await user.update({vendorCode: text});
        return bot.sendMessage(chatId, `Артикул "<b>${text}</b>" успешно сохранён\n<pre>(для перезаписи введите артикул повторно)</pre>`, startFindOptions);
    }
    
    //вывод информации
    if (text === '/infowork') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        return bot.sendMessage(chatId, `${user.nickname} вот, что вы искали:\n\n${user.typeFind}\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\n\nВаш email: ${user.email}`);
    }

    if (text === 'recreatetable' && chatId === '356339062') {
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        await User.sync({ force: true })
        return bot.sendMessage(chatId, 'Таблица для модели `User` только что была создана заново!')
    }


    if (text.toLowerCase() === 'привет' + '') {
        return bot.sendSticker(chatId, 'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp')
    }

    if (text === '/infogame') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        lc = null;
        return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions)
    }   

    if (text !== '/game' && text !== '/start') {
        await bot.deleteMessage(chatId, msg.message_id);
        await bot.deleteMessage(chatId, (msg.message_id -= 1));
        return bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')
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

        //главное меню
        if (data === '/mainmenu') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = null;
            return bot.sendMessage(chatId, `Главное меню, ${user.nickname}\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`)
        }
        
        //начало работы
        if(data === '/beginwork') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = null;
            return bot.sendMessage(chatId, 'И так, с чего начнем?', workOptions)
        }
        
        //наличие, сроки, резерв           
        if(data === '/work1') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = data;
            return bot.sendMessage(chatId, 'Хорошо, что мы ищем?', work1Options);
        }

        //запись typeFind
        if(data === 'Текстиль') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            await user.update ({
                typeFind: data,
            });
            return bot.sendMessage(chatId, `${data}, так и запишем..`, brandOptions);
        }

        //запись typeFind
        if(data === 'Обои') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            await user.update ({
                typeFind: data,
            });
            return bot.sendMessage(chatId, `${data}, так и запишем..`, brandOptions);
        }

        //Вводим название бренда
        if(data === '/enterBrand') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = data;
            return bot.sendMessage(chatId, `Введите название бренда:`);
        }

        //вводим артикул
        if(data === '/enterVC') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = data;
            return bot.sendMessage(chatId, `Введите артикул:`);
        }
        
        //поиск по введенным параметрам: brand, vendorCode, typeFind
        if(data === '/startFind') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = null;
            return bot.sendMessage(chatId, sorry, mainMenuOptions);
        }

        //превью фото
        if(data === '/work2') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = null;
            return bot.sendMessage(chatId, sorry, mainMenuOptions);
        }

        //добавить в заказ
        if(data === '/work3') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = null;
            return bot.sendMessage(chatId, sorry, mainMenuOptions);
        }


        //рестарт игры
        if (data === '/again') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = data;
            return startGame(chatId);
        }

        //рестарт игры
        if (data === '/infogame') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            lc = null;
            return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions) 
        }

        //сброс результатов игры
        if(data === '/reset') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            if (user) {
                await user.update ({
                    right: 0,
                    wrong: 0,
                });

            } else {
            await bot.deleteMessage(chatId, msg.message.message_id);
        }
            return bot.sendMessage(chatId, `Результаты игры сброшенны:\nправильных ${user.right},\nнеправильных ${user.wrong}`, againOptions)
        }

        //запись результата игры в БД
        if (lc === '/game' || lc === '/again') {
            await bot.deleteMessage(chatId, msg.message.message_id);
            if (data == chats[chatId]) {
                user.right += 1;
                await user.save();
                await bot.sendMessage(chatId, `Ты отгадал цифру "${chats[chatId]}"`, againOptions);
            } else {
                user.wrong += 1;
                await user.save();
                await bot.sendMessage(chatId, `Нет, я загадал цифру "${chats[chatId]}"`, againOptions);  
            }
        }

        } catch (err) {
            await bot.deleteMessage(chatId, msg.message.message_id);            
            return bot.sendMessage(chatId, 'Ошибка в исполнении кода прослушивателя колбэков', err);
        }

    })

}

start()

    
