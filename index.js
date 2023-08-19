const TelegramApi = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
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

//ИМПОРТЫ
const {gameOptions, againOptions, resetOptions,
     workOptions, VCOptions, startFindOptions, 
     beginWorkOptions, beginWork2Options, mainMenuOptions, 
     enterReserveNumberOptions, sendReserveOptions, beginWork3Options} = require('./options');
const sequelize = require('./db');
const UserModel = require('./models');
const {transporter, recipient} = require('./nodemailer');
const clientRDP = require('./rdp');
//const BrandModel = require('./models');

//ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
chats = {};
lc = {};    //последняя команда
plc = {};   //предпоследняя команда
botMsgIdx = {};    //айди последнего сообщения от бота
sorry = 'Извините, я этому пока ещё учусь😅\nПрошу вас, обратитесь с данным запросом к\npurchasing_internal@manders.ru';
let subject = {};   //тема письма
let textMail = {};  //текст письма




//МЕНЮ КОМАНД
bot.setMyCommands([
    {command: '/mainmenu', description:'Главное меню'},
    {command: '/beginwork', description:'Начало работы'},
    {command: '/infowork', description:'Проверка введенных параметров'},
])


//ФУНКЦИИ=========================================================================================

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

        //Создаём переменную с ссылкой на первый товар из поиска 
        const firstProductLink = $('h3.item__card__title.card-product-general__title.mb-2 a').attr('href');

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
                availabilityContent += `${$$(names[0]).text()}: <pre>${$$(cells[0]).text()}</pre>\n`;
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
                expectedArrivalContent += `${$$(names[0]).text()}: <pre>${$$(cells[0]).text()}</pre>\n`;
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
    //
    const copy = `${user.email}`;   //ВАЖНО: Ставить в копию только     purchasing_internal@manders.ru

    try {

        let result = transporter.sendMail({
            from: 'n_kharitonov@manders.ru',
            to: `${recipient}, ${copy}`,
            subject: subject,
            text: textMail,
        });
        
        console.log(result);
        bot.sendMessage(chatId, `Сообщение с темой: \n<pre>"${subject}"</pre>\nуспешно отправлено поставщику и в отдел закупок.\n\nЧтобы узнать о состоянии резерва напишите письмо с вышеупомянутой темой на <b>purchasing_internal@manders.ru</b>.`, beginWork2Options)

      } catch (e) {
        console.error(e);
        throw new Error('Ошибка при отправке е-мейла');
    }
}

// Функция для поиска эксель файла в указанной папке и ее подпапках
async function findExcelFile() {
    const folderPath = '/root/zak/xl';
    const files = await fs.promises.readdir(folderPath);
    let fileNameWallpaper = null;
    let fileNameTextile = null;
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = await fs.promises.stat(filePath);
      
      if (stat.isDirectory()) {
        const result = await findExcelFiles(filePath);
        
        if (result.fileNameWallpaper) {
          fileNameWallpaper = result.fileNameWallpaper;
        }
        
        if (result.fileNameTextile) {
          fileNameTextile = result.fileNameTextile;
        }
      } else if (path.extname(file) === '.xlsx') {
        if (file === 'Каталоги  распределение в салоны 26.09.19.xlsx') {
          fileNameWallpaper = filePath;
        } else if (file === 'Текстиль Каталоги  распределение в салоны.xlsx') {
          fileNameTextile = filePath;
        }
      }
      
      if (fileNameWallpaper && fileNameTextile) {
        break;
      }
    }
    
    return { fileNameWallpaper, fileNameTextile };
  }

//Функция поиска каталога обоев
async function findCatalogWallpaper(chatId, fileNameWallpaper) {

    if (fileNameWallpaper) {
        const workbookWallpaper = new ExcelJS.Workbook();
        const stream = fs.createReadStream(fileNameWallpaper);
        const wbWallpaper = await workbookWallpaper.xlsx.read(stream);
        const worksheetWallpaper = wbWallpaper.worksheets[0];

        let user = await UserModel.findOne({
          where: {
            chatId: chatId
          }
        });

        let foundMatchWallpaper = false;
        for (const row of worksheetWallpaper.eachRow()) {

            const cellValue = row.getCell('B').value;

            if (cellValue == user.catalog) {
                foundMatchWallpaper = true;

                const hValue = row.getCell('H').value;
                const iValue = row.getCell('I').value;
                const jValue = row.getCell('J').value;
                const kValue = row.getCell('K').value;
                const mValue = row.getCell('M').value;
                const nValue = row.getCell('N').value;
                const oValue = row.getCell('O').value;
                const pValue = row.getCell('P').value;

                if (
                    hValue !== null &&
                    iValue !== null &&
                    jValue !== null &&
                    kValue !== null &&
                    (mValue !== null || nValue !== null)
                ) {

                const h1Value = worksheetWallpaper.getCell(`H1`).value;
                const i1Value = worksheetWallpaper.getCell(`I1`).value;
                const j1Value = worksheetWallpaper.getCell(`J1`).value;
                const k1Value = worksheetWallpaper.getCell(`K1`).value;
                const m1Value = worksheetWallpaper.getCell(`M1`).value;
                const n1Value = worksheetWallpaper.getCell(`N1`).value;
    
                let message = `Каталог с данным артикулом имеется в следующих магазинах:\n`;
                message += `${h1Value}: ${hValue}\n`;
                message += `${i1Value}: ${iValue}\n`;
                message += `${j1Value}: ${jValue}\n`;
                message += `${k1Value}: ${kValue}\n`;
                message += `${m1Value}: ${mValue}\n`;
                message += `${n1Value}: ${nValue}\n`;
    
                if (pValue !== null) {
                    const p1Value = worksheetWallpaper.getCell(`P1`).value;
                    message += `${p1Value}: ${pValue}\n`;
                }

                if (oValue !== null) {
                    const o1Value = worksheetWallpaper.getCell(`O1`).value;
                    message += `${o1Value}: ${oValue}\n`;
                }
    
                bot.deleteMessage(chatId, botMsgIdx);
                bot.sendMessage(chatId, message, beginWork3Options);

                }
            } else {

                bot.deleteMessage(chatId, botMsgIdx);
                return bot.sendMessage(
                    chatId,
                    `Каталогов в салоне нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.`
                );
            }
        };
    }      
}

//Функция поиска каталога текстиля
async function findCatalogTextile(chatId, fileNameTextile) {

    if (fileNameTextile) {
        const workbookTextile = new ExcelJS.Workbook();
        const wbTextile = await workbookTextile.xlsx.fileStream(fileNameTextile);
        const worksheetTextile = wbTextile.worksheets[0];

        let user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
        });

        let foundMatchTextile = false;
        worksheetTextile.eachRow((row, rowNumber) => {

            const cellValue = row.getCell('B').value;

            if (cellValue == user.catalog) {
                foundMatchTextile = true;
                const iValue = row.getCell('I').value;
                const jValue = row.getCell('J').value;
                const kValue = row.getCell('K').value;
                const lValue = row.getCell('L').value;
                const nValue = row.getCell('N').value;
                const oValue = row.getCell('O').value;
                const pValue = row.getCell('P').value;

                if (iValue !== null ||
                    jValue !== null ||
                    kValue !== null ||
                    lValue !== null ||
                    nValue !== null ||
                    oValue !== null) {
                    const i1Value = worksheetTextile.getCell(`I1`).value;
                    const j1Value = worksheetTextile.getCell(`J1`).value;
                    const k1Value = worksheetTextile.getCell(`K1`).value;
                    const l1Value = worksheetTextile.getCell(`L1`).value;
                    const n1Value = worksheetTextile.getCell(`N1`).value;
                    const o1Value = worksheetTextile.getCell(`O1`).value;
                    const p1Value = worksheetTextile.getCell(`P1`).value;

                    let message = `Каталог с данным артикулом имеется в следующих магазинах:\n`;
                    message += `${i1Value}: ${iValue}\n`;
                    message += `${j1Value}: ${jValue}\n`;
                    message += `${k1Value}: ${kValue}\n`;
                    message += `${l1Value}: ${lValue}\n`;
                    message += `${n1Value}: ${nValue}\n`;
                    message += `${o1Value}: ${oValue}\n`;

                    if (pValue !== null) {
                        const p1Value = worksheetWallpaper.getCell(`P1`).value;
                        message += `${p1Value}: ${pValue}\n`;
                    }

                    bot.deleteMessage(chatId, botMsgIdx);
                    bot.sendMessage(chatId, message, beginWork3Options);

                } else {

                    bot.deleteMessage(chatId, botMsgIdx);
                    return bot.sendMessage(
                        chatId,
                        `Каталогов в салоне нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.`
                    );
                }
            }
        });
    }
}


//СТАРТ РАБОТЫ ПРОГРАММЫ=============================================================================================================

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
            return bot.sendMessage(
                chatId, 
                `И снова здравствуйте, ${user.nickname}!
                \n\nНачать работу: /beginwork,
                \nПроверить введенные данные: /infowork,
                \n\nИзменить e-mail: /editEmail,
                \nИзменить обращение /editNickname`)
        } else {
            user = await UserModel.create({chatId});
            console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);
             await user.update({
                firstName: msg.from.first_name, 
                lastName: msg.from.last_name, 
            });
            lc = '/editNickname';
            return bot.sendMessage(
                chatId, 
                `Приветcтвую, ${msg.from.first_name}! Меня зовут бот Зак.
                \nПриятно познакомиться!
                \nЯ могу подсказать наличие товара по поставщику ОПУС, а также узнать сроки поставки и запросить резервирование.
                \nКак я могу к вам обращаться?`);
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

bot.onText(/\/x/, async msg => {
    const chatId = msg.chat.id;
    lc = null; 

    })
);

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

    try {
    //главное меню
    if (text === '/mainmenu') {
        
        if (user) {
            lc = null;
            await bot.sendMessage(
                chatId, 
                `И снова здравствуйте, ${user.nickname}!
                \nНачать работу: /beginwork,
                \nПроверить введенные данные: /infowork,
                \n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`);
        }
        return;
    }

    //начало работы
    if (text === '/beginwork') {

        if (!user.email) {
            await editEmail(chatId);
        } else {
            await bot.sendMessage(chatId, 'Чем могу вам помочь?', workOptions);
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
        return bot.sendMessage(
            chatId, 
            `Ваш e-mail "<b>${user.email}</b>" успешно сохранён
            \n<pre>(для перезаписи введите e-mail повторно)</pre>`, beginWorkOptions);
    }            

    //изменить Nickname
    if (text === '/editNickname') {
        return editNickname(chatId);
    }
    
    //Записываем Nickname в ячейку БД
    if (lc === '/editNickname') {
        await user.update({nickname: text});
        return bot.sendMessage(
            chatId, 
            `Хорошо, "<b>${user.nickname}</b>", я запомню.
            \n<pre>(для перезаписи введите никнейм повторно)</pre>`, mainMenuOptions)
    }

    //Записываем название бренда в ячейку БД
    if (lc === '/enterBrand') {
        await user.update({brand: text.toLowerCase()});
        return bot.sendMessage(
            chatId, 
            `Название бренда "<b>${text}</b>" успешно сохранено
            \n<pre>(для перезаписи введите бренд повторно)</pre>`, VCOptions);
    }

    //Записываем название бренда в ячейку БД
    if (lc === '/enterReserveNumber') {
        await user.update({reserveNumber: text});

        if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {
            return bot.sendMessage(
                chatId, 
                `Вы желаете зарезервировать партию <b>${user.reserveNumber.split(" ")[0]}</b> в колличестве <b>${user.reserveNumber.split(" ")[1]}</b> шт?
                \n<pre>(для перезаписи введите информацию повторно)</pre>`, enterReserveNumberOptions);
        } else {
            return bot.sendMessage(
                chatId, 
                `Вы желаете зарезервировать  <b>${user.vendorCode}</b> в колличестве <b>${user.reserveNumber}</b> шт?
                \n<pre>(для перезаписи введите информацию повторно)</pre>`, enterReserveNumberOptions);
        }
    }

    //Записываем артикул в ячейку БД и начинаем поиск на сайте
    if (lc === '/enterVC') {
        await user.update({vendorCode: text});
        await bot.sendMessage(
            chatId, 
            'Идёт обработка вашего запроса . . .');
        botMsgIdx = msg.message_id += 1; 
        return startFind(chatId);
    }

    //Записываем артикул каталога
    if(lc === '/catalogСheck') {
        await user.update(
            {catalog: text}
            );
        await bot.sendMessage(
            chatId, 
            'Идёт поиск каталога . . .');
        botMsgIdx = msg.message_id +=1 ; 
        return findCatalogWallpaper(chatId);
    }
    
    //вывод информации
    if (text === '/infowork') {
        return bot.sendMessage(
            chatId, 
            `${user.nickname} вот, что вы искали:
            \n\n${user.typeFind}
            \nБренд: ${user.brand}
            \nАртикул: ${user.vendorCode}
            \n\nВаш email: ${user.email}`);
    }


    if (text === '/infogame') {
        lc = null;
        return bot.sendMessage(
            chatId, 
            `Правильных ответов: "${user.right}"
            \nНеправильных ответов: "${user.wrong}"`, resetOptions);
    }   
    
    if (text.toLowerCase().includes('привет')) {
        return bot.sendSticker(
            chatId, 
            'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp');
    }

    if (text !== '/game' && text !== '/start') {
        return bot.sendSticker(
            chatId, 
            'https://tlgrm.ru/_/stickers/ccd/a8d/ccda8d5d-d492-4393-8bb7-e33f77c24907/12.webp');
    }
    } catch {
        console.log('Сработал слушатель документов.')
    }


}) 
//СЛУШАТЕЛЬ ДОКУМЕНТОВ========================================================================================================================================

bot.on('message', async msg => {

    try {
        const file_name = msg.document.file_name;
        const chatId = msg.chat.id;

        if (msg.document) {
            if ((file_name.includes('Каталоги'))) {
            
                await bot.getFile(msg.document.file_id).then((file) => {
                    const fileName = msg.document.file_name;
                    const fileStream = bot.getFileStream(file.file_id);
                    
                    fileStream.pipe(fs.createWriteStream(`/root/zak/xl/${fileName}`));
                    
                    fileStream.on('end', () => {
                        bot.sendMessage(chatId, `"${fileName}" успешно сохранен.`);
                    });
                });
                return;
            } else {
                return bot.sendMessage(chatId, `В целях экономии памяти, я сохраняю лишь определённые эксель файлы\nЕсли желаете, чтобы я научился работать с вашим документом, то обратитесь к моему разработчику\nn_kharitonov@mander.ru`);
            }
        }
    } catch {
        console.log('Cработал слушатель сообщений.')
    }

});

//слушатель колбэков==========================================================================================================================================

bot.on('callback_query', async msg => {
    const data = msg.data;
    const chatId = msg.message.chat.id;

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
        if (lc === '/game' || lc === '/again' || lc === '/reset') {
            await bot.deleteMessage(chatId, msg.message.message_id);
        }
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
        return bot.sendMessage(chatId, `Введите номер партии и колличество, которое желаете зарезервировать:\n<i>например: 268А 3\nесли партия отсутствует, то введите только колличество</i>`, { parse_mode: "HTML" })
    }

    //подтверждение резервирования
    if (data === '/preSendEmail') {
        lc = data;
        if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {
            subject = `Резерв ${user.vendorCode}, партия: ${user.reserveNumber.split(" ")[0]}, ${user.reserveNumber.split(" ")[1]} шт по запросу ${(user.email).split("@")[0]}`;
            text = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, партия: ${user.reserveNumber.split(" ")[0]} в колличестве: ${user.reserveNumber.split(" ")[1]} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        } else {
            subject = `Резерв ${user.vendorCode},  ${user.reserveNumber} шт, по запросу ${(user.email).split("@")[0]}`;
            text = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        }
        return bot.sendMessage(chatId, `Сформированно следующее сообщение:${text}`, sendReserveOptions)
    }

    //отправка сообщения с запросом резервирования
       if (data === '/sendReserveEmail') {
        lc = data;
        return sendReserveEmail(chatId);
    }

    //проверка каталога в наличии в салоне
    if(data === '/catalogСheck') {
        lc = data;
        return bot.sendMessage(chatId, 'Введите артикул каталога содержащего искомый вами товар:');
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
        await bot.deleteMessage(chatId, msg.message.message_id);
        return startGame(chatId);
    }

    //рестарт игры
    if (data === '/infogame') {
        lc = data;
        await bot.deleteMessage(chatId, msg.message.message_id);
        return bot.sendMessage(chatId, `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions) 
    }

    //сброс результатов игры
    if(data === '/reset') {
        lc = data;
        await bot.deleteMessage(chatId, msg.message.message_id);
        if (user) {
            await user.update ({
                right: 0,
                wrong: 0,
            });
        }

        return bot.sendMessage(chatId, `Результаты игры сброшенны:\nправильных ${user.right},\nнеправильных ${user.wrong}`, againOptions)
    }

    //запись результата игры в БД
    if (lc === '/game' || lc === '/again') {
        if (data == chats[chatId]) {
            user.right += 1;
            await user.save(chatId);
            await bot.deleteMessage(chatId, msg.message.message_id);
            return bot.sendMessage(chatId, `Ты отгадал цифру "${chats[chatId]}"`, againOptions);
        } else {
            user.wrong += 1;
            await user.save();
            await bot.deleteMessage(chatId, msg.message.message_id);
            return bot.sendMessage(chatId, `Нет, я загадал цифру "${chats[chatId]}"`, againOptions);  
        }
    }

    } catch (err) {      
        return bot.sendMessage(chatId, 'Ошибка в исполнении кода прослушивателя колбэков', err);
    }

})

}

start();

    
