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
const {gameOptions, againOptions, resetOptions, workOptions, work1Options, VCOptions, brandOptions, startFindOptions, startworkOptions} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');

//глобальные переменные
chats = {};
brandx = {};
vendorCodex = {};
typex = {};
lc = {};
plc = {};

//меню команд
bot.setMyCommands([
    {command: '/start', description:'Главное меню'},
    {command: '/startwork', description:'Начало работы'},
    {command: '/infowork', description:'Проверка введенных параметров'},
    //{command: '/infogame', description:'Результаты в игре'},
    //{command: '/game', description:'Игра в угадайку'},
])



const startGame = async (chatId) => {
        const randomNumber = Math.floor(Math.random() * 10)
        chats[chatId] = randomNumber;
        await bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
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
/*    bot.onText(/\/start/, async msg => {
        const chatId = msg.chat.id;
        const text = msg.text;
    
        try {
            let user = await UserModel.findOne({
                where: {
                    chatId: chatId
                }
            });
    
            if (user) {
                return bot.sendMessage(chatId, `И снова здравствуй, ${msg.from.first_name}!\nВыбери команду /startwork, чтобы начать работу)`)
            }
    
            if (!user) {
                user = await UserModel.create({chatId});
                console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);
    
                await user.update({
                    firstName: msg.from.first_name, 
                    lastName: msg.from.last_name, 
                });
    
                return bot.sendMessage(chatId, `Привет, ${msg.from.first_name}. Меня зовут бот Зак.\nПриятно познакомиться! Я успешно внёс Ваш id:${chatId} в свою базу данных.\nЯ могу подсказать наличие товара по поставщику ОПУС, а также узнать сроки поставки и запросить резервирование.\nЧтобы начать работу выбери в меню команду /startwork`);
            }
    
        } catch (e) {
        await bot.sendMessage(chatId, 'Ошибка при создании нового пользователя')
        console.log('Ошибка при создании нового пользователя', e);
        }    
    })
*/

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

                if (user) {
                    lc = text;
                    return bot.sendMessage(chatId, `И снова здравствуй, ${msg.from.first_name}!\nначать работу: /startwork,\nпроверить введенные данные:/infowork`)
                }

                if (!user) {
                    user = await UserModel.create({chatId});
                    console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);

                    await user.update({
                        firstName: msg.from.first_name, 
                        lastName: msg.from.last_name, 
                    });
                    lc = text;
                    return bot.sendMessage(chatId, `Привет, ${msg.from.first_name} 'Меня зовут бот Зак.\nПриятно познакомиться! Я успешно внёс Ваш id:${chatId} в свою базу данных.\nЯ могу подсказать наличие товара по поставщику ОПУС, а также узнать сроки поставки и запросить резервирование.\nЧтобы начать работу выбери в меню команду /startwork`);
                }

            } catch (e) {
            console.log('Ошибка при создании нового пользователя', e);
            }

        }

        //Главное меню
            if (text === '/startwork') {

                if (!user.email) {
                    lc = text;
                    return bot.sendMessage(chatId, 'Для начала введите ваш рабочий e-mail, это пригодится нам для работы в дальнейшем:')
                } else {
                    lc = null;
                    return bot.sendMessage(chatId, 'И так, с чего начнем?', workOptions)
                }

                
            }

            //Записываем e-маил в ячейку БД
            if (lc === '/startwork') {
                await user.update({email: text});
                return bot.sendMessage(chatId, `Ваш e-mail "<b>${user.email}</b>" успешно сохранён\n<pre>(для перезаписи введите email повторно)</pre>`, startworkOptions)
  
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
                return bot.sendMessage(chatId, `Вы ищите: ${user.typeFind}\nбренд: ${user.brand}\nартикул: ${user.vendorCode}\nпоследняя команда: ${lc}`);
            }

            //результаты игры
            if (text === '/infogame') {
                lc = text;
                return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions)   
            }
    
            //функция игры
            if (text === '/game') {
                lc = text;
                await bot.sendMessage(chatId, `Сейчас загадаю цифру`)
                const randomNumber = Math.floor(Math.random() * 10)
                chats[chatId] = randomNumber;
                return bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
            }

            if (text === 'recreatetable' && chatId === '356339062') {
                await User.sync({ force: true })
                return bot.sendMessage(chatId, 'Таблица для модели `User` только что была создана заново!')
            }


            if (text.toLowerCase() === 'привет' + '') {
                return bot.sendSticker(chatId, 'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp')
            }


        await bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')
        return bot.sendMessage(chatId, 'Не понимаю тебя..')

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

        //Наличие, сроки, резерв
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
                return bot.sendMessage(chatId, `Ты отгадал цифру "${chats[chatId]}"`, againOptions)
            } else {
                user.wrong += 1;
                await user.save();
                return bot.sendMessage(chatId, `Нет, я загадал цифру "${chats[chatId]}"`, againOptions)
            }
        }

        } catch (err) {
            return bot.sendMessage(chatId, 'Ошибка в исполнении кода прослушивателя колбэков', e);
        }

    })

}

start()

    
