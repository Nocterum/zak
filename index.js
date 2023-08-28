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
findCatalogIndex = {};   //состояние: нужно ли зайдествовать функцию поиска каталога текстиля.
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

//Функция для поиска эксель файла
async function findExcelFile(
    fileNameWallpaper = '', 
    fileNameTextile = '', 
    fileNamePricelist = '',
    fileNameOracMSK = '', 
    fileNameOracSPB = ''
    ) {
    const folderPath = '/root/zak/xl';
    const files = await fs.promises.readdir(folderPath);

    for (const file of files) {

        const filePath = path.join(folderPath, file);
        const stat = await fs.promises.stat(filePath);

        if (stat.isDirectory()) {

            const result = await findExcelFile(filePath, 
                fileNameWallpaper, 
                fileNameTextile, 
                fileNamePricelist, 
                fileNameOracMSK, 
                fileNameOracSPB
                );

            if (result.fileNameWallpaper) {
                fileNameWallpaper = result.fileNameWallpaper;
            }
            if (result.fileNameTextile) {
                fileNameTextile = result.fileNameTextile;
            }
            if (result.fileNamePricelist) {
                fileNamePricelist = result.fileNamePricelist;
            }
            if (result.fileNameOracMSK) {
                fileNameOracMSK = result.fileNameOracMSK;
            }
            if (result.fileNameOracSPB) {
                fileNameOracSPB = result.fileNameOracSPB;
            }
        } else if (path.extname(file) === '.xlsx') {
            if (file.toLowerCase().includes('каталоги_распределение_в_салоны_26_09_19')) {
                fileNameWallpaper = filePath;
            } else if (file.toLowerCase().includes('текстиль_каталоги_распределение_в_салоны')) {
                fileNameTextile = filePath;
            } else if (file.toLowerCase().includes('список_прайслистов')) {
                fileNamePricelist = filePath;
            } else if (file.toLowerCase().includes('остатки_мск_08.08')) {
                fileNameOracMSK = filePath;
            } else if (file.toLowerCase().includes('остатки_спб_08.08')) {
                fileNameOracSPB = filePath;
            }
        }
        if (fileNameWallpaper && 
            fileNameTextile && 
            fileNamePricelist && 
            fileNameOracMSK &&
            fileNameOracSPB
            ) {
            break;
        }
    }
    return { 
        fileNameWallpaper, 
        fileNameTextile, 
        fileNamePricelist, 
        fileNameOracMSK,
        fileNameOracSPB
    };
}

//Функция поиска ссылки на прайслист
async function findPricelistLink(chatId) {

    let fileNamePricelist = 'Список_прайслистов.xlsx';
    fileNamePricelist = fileNamePricelist.toLowerCase();
    const result = await findExcelFile(fileNamePricelist);
    const filePath = result.fileNamePricelist;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
              chatId: chatId
            }
        });

        try { 

            const workbook = new ExcelJS.Workbook();
            const stream = fs.createReadStream(filePath);
            const worksheet = await workbook.xlsx.read(stream);
            const firstWorksheet = worksheet.worksheets[0];

            let foundMatchPricelist = false;
            let messagePrice = '';

            firstWorksheet.eachRow((row, rowNumber) => {
                const cellValue = row.getCell('B').value;    

                if (cellValue === user.brand) {
                    foundMatchPricelist = true;
                    const aValue = row.getCell('A').value;
                    const bValue = row.getCell('B').value;
                    const cValue = row.getCell('C').value;

                    if (cValue !== null ) {
                        const formattedCValue = cValue.toString().replace(/\\/g, '\\');
                        messagePrice += `Ссылка на папку с прайс-листом бренда <b>${bValue}</b> поставщика <b>${aValue}</b>:<pre>\n${formattedCValue}</pre>`;
                        bot.sendMessage(chatId, messagePrice, beginWork3Options);
                    }
                }
            });

            if (!foundMatchPricelist) {
                return bot.sendMessage(chatId, `Прайс-лист по бренду <b>${user.brand}</b> в локальных файлах не найден.\nЗапросите прайсы в отделе закупок.`, beginWork3Options);
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

//Функция поиска артикула ORAC
async function findOrac(chatId) {

    let fileNameOracMSK = 'Остатки_МСК_08.08.xlsx';
    fileNameOracMSK = fileNameOracMSK.toLowerCase();

    let fileNameOracSPB = 'Остатки_СПБ_08.08.xlsx';
    fileNameOracSPB = fileNameOracSPB.toLowerCase();

    const resultMSK = await findExcelFile(fileNameOracMSK);
    const resultSPB = await findExcelFile(fileNameOracSPB);

    const filePathMSK = resultMSK.fileNameOracMSK;
    const filePathSPB = resultSPB.fileNameOracSPB;

    const user = await UserModel.findOne({
        where: {
          chatId: chatId
        }
    });

    if (filePathMSK) {
        try {

            const workbookMSK = new ExcelJS.Workbook();
            const streamMSK = fs.createReadStream(filePathMSK);
            const worksheetMSK = await workbook.xlsx.read(streamMSK);
            const firstWorksheetMSK = worksheetMSK.worksheets[0];

            let foundMatchOracMSK = false;
            let messageOracMSK = '';

            firstWorksheetMSK.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim();
                const formatedUserVC = user.vendorCode.toString().trim();

                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracMSK = true;
                    const bValue = row.getCell('B').value; //Еденицы измерения
                    const cValue = row.getCell('C').value; //Колличество
                    const a3Value = firstWorksheetMSK.getCell('A3').value; //Название склада

                    messageOracMSK += `Артикул <b>${cellValue}</b> имеется на складе <b>${a3Value}</b>\nв колличестве <b>${cValue}</b> <b>${bValue}</b>`;
                    
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    await bot.sendMessage(chatId, messageOracMSK, { parse_mode: "HTML" });
                    messageOracMSK = null;
                }
            });

        } catch {
            console.error(`Ошибка при чтении файла ${filePathMSK}:`, error); 
        }
    }

    if (filePathSPB) {
        try {

            const workbookSPB = new ExcelJS.Workbook();
            const streamSPB = fs.createReadStream(filePathSPB);
            const worksheetSPB = await workbook.xlsx.read(streamSPB);
            const firstWorksheetSPB = worksheetSPB.worksheets[0];

            let foundMatchOracSPB = false;
            let messageOracSPB = '';

            firstWorksheetSPB.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim();
                const formatedUserVC = user.vendorCode.toString().trim();
                
                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracSPB = true;
                    const bValue = row.getCell('C').value; //Еденицы измерения
                    const cValue = row.getCell('D').value; //Колличество
                    const a3Value = firstWorksheetSPB.getCell('A3').value; //Название склада

                    messageOracSPB += `Артикул <b>${cellValue.trim()}</b> имеется на складе <b>${a3Value.trim()}</b>\nв колличестве <b>${cValue.trim()}</b> <b>${bValue.trim()}</b>`;
                    
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    await bot.sendMessage(chatId, messageOracSPB, { parse_mode: "HTML" });
                    messageOracSPB = null;
                }
            });

        } catch {
            console.error(`Ошибка при чтении файла ${filePathSPB}:`, error); 
        }
    }

};

//Функция поиска каталога обоев
async function findCatalogWallpaper(chatId) {

    let fileNameWallpaper = 'Каталоги_распределение_в_салоны_26_09_19.xlsx';
    fileNameWallpaper = fileNameWallpaper.toLowerCase();
    const result = await findExcelFile(fileNameWallpaper);
    const filePath = result.fileNameWallpaper;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
              chatId: chatId
            }
        });

        try { 

            const workbook = new ExcelJS.Workbook();
            const stream = fs.createReadStream(filePath);
            const worksheet = await workbook.xlsx.read(stream);
            const firstWorksheet = worksheet.worksheets[0];

            let foundMatchWallpaper = false;
            let message = '';

            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;
                const formatedCellValue = cellValue.toString().split("/")[0];
                const formatedUserCatalog = user.catalog.toString().trim();

                if (formatedCellValue.toLowerCase().includes(formatedUserCatalog.toLowerCase().trim())) { //Поиск совпадений
                // if (formatedCellValue.toLowerCase().trim() === (formatedUserCatalog.toLowerCase().trim())) { //Точный поиск наименования
                    foundMatchWallpaper = true;
                    const cValue = row.getCell('C').value;
                    const hValue = row.getCell('H').value;
                    const iValue = row.getCell('I').value;
                    const jValue = row.getCell('J').value;
                    const kValue = row.getCell('K').value;
                    const mValue = row.getCell('M').value;
                    const nValue = row.getCell('N').value;
                    const oValue = row.getCell('O').value;
                    const pValue = row.getCell('P').value;
                    user.update({brand: cValue});

                    if (
                        hValue !== null ||
                        iValue !== null ||
                        jValue !== null ||
                        kValue !== null ||
                        mValue !== null || 
                        nValue !== null
                    ) {
                        const h1Value = firstWorksheet.getCell('H1').value;
                        const i1Value = firstWorksheet.getCell('I1').value;
                        const j1Value = firstWorksheet.getCell('J1').value;
                        const k1Value = firstWorksheet.getCell('K1').value;
                        const m1Value = firstWorksheet.getCell('M1').value;
                        const n1Value = firstWorksheet.getCell('N1').value;
                        const p1Value = firstWorksheet.getCell('P1').value;
                        const o1Value = firstWorksheet.getCell('O1').value;

                        message += `<b>${cellValue.trim()}</b> бренда <b>${cValue}</b> имеется в следующих магазинах:\n`;
                        
                        if (hValue !== null) {
                            message += `${h1Value}: ${hValue}\n`;
                        }
                        if (iValue !== null) {
                            message += `${i1Value}: ${iValue}\n`;
                        }
                        if (jValue !== null) {
                            message += `${j1Value}: ${jValue}\n`;
                        }
                        if (kValue !== null) {
                            message += `${k1Value}: ${kValue}\n`;
                        }
                        if (mValue !== null) {
                            message += `${m1Value}: ${mValue}\n`;
                        }
                        if (nValue !== null) {
                            message += `${n1Value}: ${nValue}\n`;
                        }
                        if (pValue !== null) {
                          message += `${p1Value}: ${pValue}\n`;
                        }
                        if (oValue !== null) {
                            message += `${o1Value}: ${oValue}\n`;
                        }
                        message += `\n`
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
                        message = null;
                    }
                }
            });

            if (foundMatchWallpaper) {
                return findPricelistLink(chatId);
            }

            if (!foundMatchWallpaper) {
                return findCatalogTextile(chatId);
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

//Функция поиска каталога текстиля
async function findCatalogTextile(chatId) {

    let fileNameTextile = 'Текстиль_Каталоги_распределение_в_салоны.xlsx';
    fileNameTextile = fileNameTextile.toLowerCase();
    const result = await findExcelFile(fileNameTextile);
    const filePath = result.fileNameTextile;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
              chatId: chatId
            }
        });

        try { 

            const workbook = new ExcelJS.Workbook();
            const stream = fs.createReadStream(filePath);
            const worksheet = await workbook.xlsx.read(stream);
            const firstWorksheet = worksheet.worksheets[0];

            let foundMatchTextile = false;
            let message = '';

            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;
                if (cellValue !== null) {
                    const formatedCellValue = cellValue.toString().split("/")[0];
                    const formatedUserCatalog = user.catalog.toString().trim();;  
                
                    if (formatedCellValue.toLowerCase().includes(formatedUserCatalog.toLowerCase().trim())) {
                        foundMatchTextile = true;
                        const cValue = row.getCell('C').value;
                        const iValue = row.getCell('I').value;
                        const jValue = row.getCell('J').value;
                        const kValue = row.getCell('K').value;
                        const lValue = row.getCell('L').value;
                        const nValue = row.getCell('N').value;
                        const oValue = row.getCell('O').value;
                        const pValue = row.getCell('P').value;
                        user.update({brand: cValue});

                        if (iValue !== null ||
                            jValue !== null ||
                            kValue !== null ||
                            lValue !== null ||
                            nValue !== null || 
                            oValue !== null
                            ) {

                                const i1Value = firstWorksheet.getCell('I1').value;
                                const j1Value = firstWorksheet.getCell('J1').value;
                                const k1Value = firstWorksheet.getCell('K1').value;
                                const l1Value = firstWorksheet.getCell('L1').value;
                                const n1Value = firstWorksheet.getCell('N1').value;
                                const o1Value = firstWorksheet.getCell('O1').value;
                                const p1Value = firstWorksheet.getCell(`P1`).value;

                            message += `<b>${cellValue.trim()}</b> бренда <b>${cValue}</b> имеется в следующих магазинах:\n`;
                            if (iValue !== null) {
                                message += `${i1Value}: ${iValue}\n`;
                            }
                            if (jValue !== null) {
                                message += `${j1Value}: ${jValue}\n`;
                            }
                            if (kValue !== null) {
                                message += `${k1Value}: ${kValue}\n`;
                            }
                            if (lValue !== null) {
                                message += `${l1Value}: ${lValue}\n`;
                            }
                            if (nValue !== null) {
                                message += `${n1Value}: ${nValue}\n`;
                            }
                            if (oValue !== null) {
                              message += `${o1Value}: ${oValue}\n`;
                            }
                            if (pValue !== null) {
                                message += `${p1Value}: ${pValue}\n`;
                            }
                            message += `\n`
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
                            message = null;
                        }
                }
        }});

            if (foundMatchTextile) {
                return findPricelistLink(chatId);
            }

            if (!foundMatchTextile) {
                bot.deleteMessage(chatId, botMsgIdx);
                bot.sendMessage(chatId, 'Каталога в салонах нет.\nОбратитесь к Юлии Скрибника за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n+7 966 321-80-08');
            }
        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
};

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
            return bot.sendMessage(chatId, `И снова здравствуйте, ${user.nickname}!\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`);
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
            await bot.sendMessage(chatId, `И снова здравствуйте, ${user.nickname}!\n\nНачать работу: /beginwork,\nПроверить введенные данные: /infowork,\n\nИзменить e-mail: /editEmail,\nИзменить обращение /editNickname`);
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
            \n<i>(для перезаписи введите e-mail повторно)</i>`, beginWorkOptions);
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
            \n<i>(для перезаписи введите никнейм повторно)</i>`, mainMenuOptions)
    }

    //Записываем название бренда в ячейку БД
    if (lc === '/enterBrand') {
        await user.update({brand: text.toLowerCase()});
        return bot.sendMessage(
            chatId, 
            `Название бренда "<b>${text}</b>" успешно сохранено
            \n<i>(для перезаписи введите бренд повторно)</i>`, VCOptions);
    }

    //Записываем название бренда в ячейку БД
    if (lc === '/enterReserveNumber') {
        await user.update({reserveNumber: text});

        if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {
            return bot.sendMessage(chatId, `Вы желаете зарезервировать партию <b>${user.reserveNumber.split(" ")[0]}</b> в колличестве <b>${user.reserveNumber.split(" ")[1]}</b> шт?\n<i>(для перезаписи введите информацию повторно)</i>`, enterReserveNumberOptions);
        } else {
            return bot.sendMessage(chatId, `Вы желаете зарезервировать  <b>${user.vendorCode}</b> в колличестве <b>${user.reserveNumber}</b> шт?\n<i>(для перезаписи введите информацию повторно)</i>`, enterReserveNumberOptions);
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
    if (lc === '/catalogСheck') {
        await user.update(
            {catalog: text}
        );
        await bot.sendMessage(chatId, 'Идёт поиск каталога . . .');
        botMsgIdx = msg.message_id += 1; 
        return findCatalogWallpaper(chatId);

    }

    if (lc === '/oracСheck') {
        await user.update(
            {vendorCode: text}
        );
        await bot.sendMessage(chatId, `Идёт поиск ${text} . . .`);
        botMsgIdx = msg.message_id += 1; 
        return findOrac(chatId);
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

    if ( (text !== '/game' && text !== '/start') || (lc ==='/catalogСheck') || (lc === '/oracСheck') ) {
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
            if (file_name.toLowerCase().includes('каталоги') ||
                file_name.toLowerCase().includes('прайслистов') ||
                file_name.toLowerCase().includes('остатки')
                ) {
            
                await bot.getFile(msg.document.file_id).then((file) => {
                    let fileName = msg.document.file_name;
                    fileName = fileName.toLowerCase();
                    fileName = fileName.replace(/\s/g, '_');
                    const fileStream = bot.getFileStream(file.file_id);
                    
                    fileStream.pipe(fs.createWriteStream(`/root/zak/xl/${fileName}`));
                    
                    fileStream.on('end', () => {
                        bot.sendMessage(chatId, `"${fileName}"\nуспешно сохранен.`);
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
            textMail = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, партия: ${user.reserveNumber.split(" ")[0]} в колличестве: ${user.reserveNumber.split(" ")[1]} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        } else {
            subject = `Резерв ${user.vendorCode},  ${user.reserveNumber} шт, по запросу ${(user.email).split("@")[0]}`;
            textMail = `\n\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию: \nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber} шт.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
        }
        return bot.sendMessage(chatId, `Сформированно следующее сообщение:${textMail}`, sendReserveOptions)
    }

    //отправка сообщения с запросом резервирования
       if (data === '/sendReserveEmail') {
        lc = data;
        return sendReserveEmail(chatId);
    }

    //проверка каталога в наличии в салоне
    if(data === '/catalogСheck') {
        lc = data;
        return bot.sendMessage(chatId, 'Введите <b>наименование каталога</b> содержащего искомый вами товар:\n<i>(после получения результата, вы можете отправить новое наименование для поиска следующего каталога)</i>', {parse_mode: 'HTML'});
    }

    //проверка наличия артикула ORAC в салоне
    if(data === '/oracСheck') {
        lc = data;
        return bot.sendMessage(chatId, 'Введите искомый вами <b>артикул</b> товара ORAC :\n<i>(после получения результата, вы можете отправить новое наименование для поиска следующего каталога)</i>', {parse_mode: 'HTML'});
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

    
