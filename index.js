const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
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
const {gameOptions, againOptions, resetOptions, workOptions, VCOptions, startFindOptions, beginWorkOptions, mainMenuOptions, enterReserveNumberOptions, sendReserveOptions} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');
//const BrandModel = require('./models');

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
])


//функции=========================================================================================

//функция ввода емейла
const editEmail = async (chatId) => {
    lc = '/editEmail'
    return bot.sendMessage(chatId, `Можете ввести Ваш рабочий e-mail:`)
}

//функция ввода никнейма
const editNickname = async (chatId) => {
    lc = '/editNickname'
    return bot.sendMessage(chatId, `Можете ввести Ваш никнейм:`)
}

//функция html запроса по данным из БД
const startFind = async (chatId) => {
    lc = '/enterVC';

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    }); 

    try {

        //формируем URL для поиска
        const searchUrl = `https://opusdeco.ru/search/?type=catalog&q=${user.brand}+${user.vendorCode}`;
        console.log('сформированна ссылка');

        //Отправляем запрос на сайт
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);
        console.log('запрос на сайт отправлен');

        // Находим ссылку на первый товар в результате поиска
        const firstProductLink = $('h3.item__card__title.card-product-general__title.mb-2 a').attr('href');
        console.log('искомая ссылка открыта');

        if (firstProductLink) {
            // Переходим на страницу товара
            const productResponse = await axios.get(`https://opusdeco.ru${firstProductLink}`);
            const $$ = cheerio.load(productResponse.data);
            console.log('успешно зашёл на страницу товара');
            
            // Создаем пустую строку для хранения текстового содержимого таблицы
            let availabilityContent = ``;
            // Создаем пустую строку для хранения текстового содержимого таблицы ожидаемого поступления
            let expectedArrivalContent = ``;

            const modalBody = $$('#stockAvailabilityModal .modal-body');
            // Находим таблицу с наличием товара
            const availabilityTable = modalBody.find('table').eq(0);
            // Находим таблицу ожидаемого поступления
            const expectedArrivalTable = modalBody.find('table').eq(1);
            // Находим строки с данными о наличии товара
            const rowsValueAV = availabilityTable.find('tbody tr');
            // Находим строки с данными о поступлении товара
            const rowsValueEX = expectedArrivalTable.find('tbody tr');


            //Итерируем по строкам таблицы наличия товара
            availabilityTable.each((index, row) => {

                const rowsNames = $$(row).find('thead tr');
                const names = $$(rowsNames).find('th[scope=col]');
                
                rowsValueAV.each((index, rowValue) => {
                    const cells = $$(rowValue).find('td');
                
                // Присваиваим переменным соответствующие наименования
                availabilityContent += 'Наличие на складе:\n';
                availabilityContent += `${$$(names[0]).text()}: ${$$(cells[0]).text()}\n`;
                availabilityContent += `${$$(names[1]).text()}: ${$$(cells[1]).text()}\n`;
                availabilityContent += `${$$(names[2]).text()}: ${$$(cells[2]).text()}\n`;
                availabilityContent += `${$$(names[3]).text()}: ${$$(cells[3]).text()}\n\n`;
            });
        });

            //Итерируем по строкам таблицу 
            expectedArrivalTable.each((index, row) => {
                
                const rowsNames = $$(row).find('thead tr');
                const names = $$(rowsNames).find('th[scope=col]');

                rowsValueEX.each((index, rowValue) => {
                    const cells = $$(rowValue).find('td');
                
                // Присваиваим переменным соответствующие наименования
                expectedArrivalContent += `Ожидаемое поступление:\n`;
                expectedArrivalContent += `${$$(names[0]).text()}: ${$$(cells[0]).text()}\n`;
                expectedArrivalContent += `${$$(names[1]).text()}: ${$$(cells[1]).text()}\n`;
                expectedArrivalContent += `${$$(names[2]).text()}: ${$$(cells[2]).text()}\n`;
                expectedArrivalContent += `${$$(names[3]).text()}: ${$$(cells[3]).text()}\n\n`;
            });
        });

            await bot.deleteMessage(chatId, botMsgIdx);
            // Проверяем наличие таблицы
            if (availabilityTable.length === 0) {

                if (expectedArrivalTable.length === 1) {
                    // Отправляем информацию о поставках товара
                    bot.sendMessage(chatId, `${expectedArrivalContent}`, startFindOptions);
                    console.log('информация о поставках при отсутсвии наличия, успешно отправлена');
                    return;

                } else {

                    // Отправляем сообщение о отсутствии товара
                    bot.sendMessage(chatId, 'В данный момент товар отсутствует на складе поставщика', startFindOptions);
                    console.log('информация об отсутствии товара отправленна');
                    return;
                }
            }
                
            if (expectedArrivalTable.length === 0) {
                // Отправляем информацию о наличии товара
                bot.sendMessage(chatId, `${availabilityContent}`, startFindOptions);
                console.log('информация о наличии успешно отправлена');
                return;
            }
            
            if (availabilityTable !== expectedArrivalTable) {
            bot.sendMessage(chatId, `${availabilityContent}${expectedArrivalContent}`, startFindOptions);
            console.log('информация о наличии и поставках успешно отправленна');
            return;
            }

        } else {
            await bot.deleteMessage(chatId, botMsgIdx);
            bot.sendMessage(chatId, 'Товары не найдены. Проверьте правильное написание артикула и бренда.', startFindOptions);
            return;
        }

    } catch (e) {
        console.log('Ошибка при выполнении запроса', e);
        bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFindOptions);
        return bot.deleteMessage(chatId, botMsgIdx);
    }
   
}

//функция отправки емейла с запросом на резервирование
const sendReserveEmail = async (chatId) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    const login = 'Manders\\n_kharitonov';
    const password = '1929qweR';
    const recipient = 'nick.of.darkwood@gmail.com';
    const copy = 'from90s@gmail.com';
    const subject = `Резерв ${user.vendorCode} ${user.reserveNumber}`;
    const text = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nбренд ${user.brand}, артикул ${user.vendorCode} в колличестве ${user.reserveNumber} шт.\nПожалуйста пришлите обратную связь ответным письмом для purchasing_internal@manders.ru`;
    console.log('Информация сформированна');

    try {

        //формируем URL
        const postUrl = `https://post.manders.ru/owa/auth/logon.aspx?replaceCurrent=1&url=https%3a%2f%2fpost.manders.ru%2fowa%2f`;
        console.log('сформированна ссылка для авторизации');

        //Отправляем запрос на почтовый сервис
        const logIn = await axios.post(postUrl, {
            login,
            password
        });
        console.log('аутентификация прошла успешно');

        try {
        //===============================РАЗРАБОТКА=====================================================
        await axios.post('https://post.manders.ru/owa/#path=/mail', {
            recipient,
            copy,
            subject,
            text
        });
  
        // Отправка сообщения с помощью сочетания клавиш ctrl+enter
        await axios.post('https://post.manders.ru/owa/sendmessage.aspx', {
        send: 'true',
        });
        return bot.sendMessage(chatId, 'Емейл успешно отправлен', mainMenuOptions)
    
        } catch (e) {
            console.error(e);
            throw new Error('Ошибка при отправке емейла');
        }
 

    

      } catch (error) {
        console.error(error);
        throw new Error('Ошибка при отправке запроса на сервер');
      }


}

//=============================================================================================================

const start = async () => {
    console.log('Бот запщуен...')

    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Подключение к базе данных установленно');
    } catch(err) {
        console.log('Подключение к базе данных сломалось', err);
    }

//слушатель команд======================================================================================

//старт
bot.onText(/\/start/, async msg => {
    const chatId = msg.chat.id;

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
            return bot.sendMessage(chatId, `Приветcтвую, ${msg.from.first_name}! Меня зовут бот Зак.\nПриятно познакомиться!\nЯ могу подсказать наличие товара по поставщику ОПУС, а также узнать сроки поставки и запросить резервирование.\nКак я могу к вам обращаться?`);
        }  
     } catch (e) {
    console.log('Ошибка при создании нового пользователя', e);
    }

},

bot.onText(/\/game/, async msg => {
    const chatId = msg.chat.id;

    lc = '/game';
    const randomNumber = Math.floor(Math.random() * 10)
    chats[chatId] = randomNumber;
    return bot.sendMessage(chatId, `Отгадай число😏`, gameOptions)
    }),

bot.onText(/\/infogame/, async msg => {
    const chatId = msg.chat.id;

        lc = null;
        await bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions)
        await bot.deleteMessage(chatId, (msg.message.message_id -= 2));
        return bot.deleteMessage(chatId, (msg.message_id -= 1));
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
        
        if (user) {
            lc = null;
            await bot.sendMessage(chatId, `И снова здравствуйте, ${user.nickname}!\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`)
        }
        return;
        }

    //начало работы
    if (text === '/beginwork') {

        if (!user.email) {
            await editEmail(chatId);
        } else {
            await bot.sendMessage(chatId, 'Чем могу вам помочь?', workOptions)
        } 
        return; 
    }

    //изменить e-mail
    if (text === '/editEmail') {
        return editEmail(chatId);
    }

    //Записываем e-mail в ячейку БД
    if (lc === '/editEmail') {
        await user.update({email: text.toLowerCase()});
        return bot.sendMessage(chatId, `Ваш e-mail "<b>${user.email}</b>" успешно сохранён\n<pre>(для перезаписи введите e-mail повторно)</pre>`, beginWorkOptions)
    }            

    //изменить Nickname
    if (text === '/editNickname') {
        return editNickname(chatId);
    }
    
    //Записываем Nickname в ячейку БД
    if (lc === '/editNickname') {
        await user.update({nickname: text});
        return bot.sendMessage(chatId, `Хорошо, "<b>${user.nickname}</b>", я запомню.\n<pre>(для перезаписи введите никнейм повторно)</pre>`, mainMenuOptions)
    }

    //Записываем название бренда в ячейку БД
    if (lc === '/enterBrand') {
        await user.update({brand: text.toLowerCase()});
        return bot.sendMessage(chatId, `Название бренда "<b>${text}</b>" успешно сохранено\n<pre>(для перезаписи введите бренд повторно)</pre>`, VCOptions);
    }
    
    //Записываем название бренда в ячейку БД
    if (lc === '/enterReserveNumber') {
        await user.update({reserveNumber: text});
        return bot.sendMessage(chatId, `Вы желаете зарезервировать <b>${text}</b> шт? \n<pre>(для перезаписи введите число повторно)</pre>`, enterReserveNumberOptions);
    }

    //Записываем артикул в ячейку БД и начинаем поиск на сайте
    if (lc === '/enterVC') {
        await user.update({vendorCode: text});
        await bot.sendMessage(chatId, 'Идёт обработка вашего запроса . . .');
        botMsgIdx = msg.message_id += 1; 
        return startFind(chatId);
    }
    
    //вывод информации
    if (text === '/infowork') {
        return bot.sendMessage(chatId, `${user.nickname} вот, что вы искали:\n\n${user.typeFind}\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\n\nВаш email: ${user.email}`);
    }

    if (text === 'recreatetable' && chatId === '356339062') {
        await UserModel.sync({ force: true })
        return bot.sendMessage(chatId, 'Таблица для модели `User` только что была создана заново!')
    }

    if (text.toLowerCase() === 'привет' + '') {
        return bot.sendSticker(chatId, 'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp')
    }

    if (text === '/infogame') {
        lc = null;
        return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions)
    }   

    if (text !== '/game' && text !== '/start') {
        return bot.sendSticker(chatId, 'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp')
    }

}) 

//слушатель колбэков==========================================================================================================================================

bot.on('callback_query', async msg => {
    const data = msg.data;
    const chatId = msg.message.chat.id;
    const sorry = 'Извините, эта функция ещё в разработке 😅';

    console.log(msg)

    //функция перезапуска игры
    const startGame = async (chatId) => {
        const randomNumber = Math.floor(Math.random() * 10)
        chats[chatId] = randomNumber;
        return bot.sendMessage(chatId, `Отгадывай:`, gameOptions)
    }

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    try {

    //главное меню
    if (data === '/mainmenu') {
        lc = null;
        return bot.sendMessage(chatId, `Главное меню, ${user.nickname}\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`) 
    }
    
    //начало поиска остатков
    if(data === '/enterBrand') {
        lc = data;
        return bot.sendMessage(chatId, `Введите название бренда:`);
    }

    //ввод артикула для поиска остатков
    if(data === '/enterVC') {
        lc = data;
        return bot.sendMessage(chatId, `Введите артикул:`);
    }
    
    //начало резервирования
    if (data === '/enterReserveNumber') {
        lc = data;
        return bot.sendMessage(chatId, `Введите колличество которое желаете зарезервировать:`)
    }

    //подтверждение резервирования
    if (data === '/preSendEmail') {
        lc = data;
        return bot.sendMessage(chatId, `Сформированно следующее сообщение:\n\n"Здравствуйте!\nПросьба поставить в резерв следующую позицию: \nбренд ${user.brand}, артикул ${user.vendorCode} в колличестве ${user.reserveNumber} шт.\nДанное сообщение сформированно автоматически и на него не нужно отвечать."`, sendReserveOptions)
    }

    //отправка сообщения с запросом резервирования
       if (data === '/sendReserveEmail') {
        lc = data;
        return sendReserveEmail(chatId);
    }

    //превью фото
    if(data === '/work2') {
        lc = null;
        return bot.sendMessage(chatId, sorry, mainMenuOptions);
    }

    //добавить в заказ
    if(data === '/work3') {
        lc = null;
        return bot.sendMessage(chatId, sorry, mainMenuOptions);
    }


    //рестарт игры
    if (data === '/again') {
        lc = data;
        await bot.deleteMessage(chatId, (msg.message.message_id +=3))
        return startGame(chatId);
    }

    //рестарт игры
    if (data === '/infogame') {
        lc = null;
        await bot.deleteMessage(chatId, (msg.message.message_id += 3))
        return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions) 
    }

    //сброс результатов игры
    if(data === '/reset') {
        if (user) {
            await user.update ({
                right: 0,
                wrong: 0,
            });
        }
        await bot.deleteMessage(chatId, (msg.message.message_id += 3))
        return bot.sendMessage(chatId, `Результаты игры сброшенны:\nправильных ${user.right},\nнеправильных ${user.wrong}`, againOptions)
    }

    //запись результата игры в БД
    if (lc === '/game' || lc === '/again') {
        if (data == chats[chatId]) {
            user.right += 1;
            await user.save();
            await bot.deleteMessage(chatId, (msg.message.message_id += 3))
            return bot.sendMessage(chatId, `Ты отгадал цифру "${chats[chatId]}"`, againOptions);
        } else {
            user.wrong += 1;
            await user.save();
            await bot.deleteMessage(chatId, (msg.message.message_id += 3))
            return bot.sendMessage(chatId, `Нет, я загадал цифру "${chats[chatId]}"`, againOptions);  
        }
    }

    } catch (err) {      
        return bot.sendMessage(chatId, 'Ошибка в исполнении кода прослушивателя колбэков', err);
    }

})

}

start()

    
