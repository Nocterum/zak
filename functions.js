const axios = require('axios');
const cheerio = require('cheerio');
const XLSX = require('xlsx');
const { JSDOM } = require('jsdom');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

// ИМПОРТЫ
const { bot, botMsgIdx } = require('./index');
const sequelize = require('./db');
const UserModel = require('./models');
const {transporter, nodemailer} = require('./nodemailer');
const clientRDP = require('./rdp');

// импорт кнопок
const {
    mainMenuOptions, 
    gameOptions, 
    againOptions, 
    resetOptions, 
    resetInfoWorkOptions,
    workOptions, 
    work1Options, 
    checkVendorOptions, 
    startFindOptions, 
    startFind1Options, 
    startFind2Options, 
    beginWorkOptions, 
    beginWork2Options, 
    mainMenuReturnOptions, 
    settingsOptions, 
    enterReserveNumberOptions, 
    sendReserveOptions, 
    beginWork3Options 
} = require('./options');

// ======================================================================================================================================
// Функция прочнения файла conig.cfg
// ======================================================================================================================================

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

// ======================================================================================================================================
// Функция создания нового пользователя
// ======================================================================================================================================

const createNewUser = async (chatId, msg) => {
    
    const newUser = await UserModel.create({chatId});
    console.log(`Новый пользователь создан: ${msg.from.first_name} ${msg.from.last_name}`);

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'firstName', 'lastName', 'email', 'nickname']
    });

    return user.update({
        firstName: msg.from.first_name, 
        nickname: msg.from.first_name,
        lastName: msg.from.last_name, 
        email: '/passwordcheck',
    });
}

// ======================================================================================================================================
// Функция проверки пароля
// ======================================================================================================================================

const chekPassword = async (chatId, msg) => {
    let text = msg.text;

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }, 
        attributes: ['id', 'chatId', 'lastCommand', 'email']
    });

    if (text === '111QWER!!!') {

        // lc = '/editNickname';
        await user.update({lastCommand: '/editEmail', email: '/editEmail'}, {
            where: {
                chatId: chatId,
            }
        })

        return bot.sendMessage(
            chatId, 
            `Приветcтвую, ${msg.from.first_name}! Приятно познакомиться!\n<b>Напишите Ваш рабочий email</b>?`,
            { parse_mode: 'HTML' }
        );

    } else {

        return bot.sendMessage(
            chatId, 
            `В доступе отказано.\nВведите пароль:`
        );
    }
}

// ======================================================================================================================================
// Функция ввода email
// ======================================================================================================================================

const editEmail = async (chatId) => {
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand']
    });
    
    // lc = /editEmail
    await user.update({lastCommand: '/editEmail'}, {
        where: {
            chatId: chatId
        }
    })
    return bot.sendMessage(chatId,
        `<b>Напишите Ваш рабочий email</b>`,
        { parse_mode: 'HTML' }
    );
}

// ======================================================================================================================================
// Функция ввода никнейма
// ======================================================================================================================================

const editNickname = async (chatId) => {
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand']
    });
    
    // lc = '/editNickname'
    await user.update({lastCommand: '/editNickname'}, {
        where: {
            chatId: chatId
        }
    })
    return bot.sendMessage(chatId, `Введите пожалуйста Ваш никнейм\n<i>то как я буду к вам обращаться</i>:`),
    { parse_mode: 'HTML' }
}

// ======================================================================================================================================
// Функция поиска в 1C
// ======================================================================================================================================

const startRequest1C = async (chatId, vendorCode) => {

    try {

        const searchUrl1C = `http://post.manders.ru:10001/QuantityProduct.php?VendorCode=${vendorCode}&submit=Получить`;
        const response = await axios.get(searchUrl1C,  { timeout: 5000 });

        if (!response) {

            // let messageResult1C = `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>`
            // return { messageResult1C };

        } else {

            // Создание виртуального DOM
            const dom = new JSDOM(response.data);
            const document = dom.window.document;
    
            // Получение таблицы из DOM
            const tableElement = document.querySelector("body > table:nth-child(3)");
    
            // Получение строк таблицы
            const rows = tableElement.querySelectorAll('tr');
            // Проверка наличия данных в таблице
    
            if (rows.length > 0) {
                let warehouse, quantity, reserve;
    
                // Форматирование данных построчно
                const formatedData = Array.from(rows).map((row, index) => {
                    
                    if (!row.querySelector('td.R3C0')) {
                        const cells = row.querySelectorAll('td');
                        if (cells[0]) {
                            warehouse = cells[0].textContent.trim();  // склад
                        }
                        if (cells[1] !== '') {
                            quantity = cells[1].textContent.trim().split( "," )[0];   // колличество
                        } else {
                            quantity = '0';
                        }
                        if (cells[2] !== '') {
                            reserve = cells[2].textContent.trim().split( "," )[0];     // резерв
                        } else {
                            reserve = '0';
                        }
                    }
                    return {
                        warehouse,
                        quantity,
                        reserve
                    };
                    
                });
    
                // Вывод данных пользователю
                if (formatedData.length > 0 ) {
    
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                    let message = '';
                    let messageResult1C = formatedData.map(obj => {
                        if (obj.warehouse === undefined) {
                            return "";
                        } else {
                            message = '';
                            message += `<strong>${obj.warehouse}</strong>\n`
    
                            if (obj.quantity > 0) {
                                message += `Количество: ${obj.quantity}\n`
                            }
                            if (obj.reserve > 0) {
                                message += `Резерв: ${obj.reserve}\n`
                            }
                            message += `\n`
                            return message;
                        }
                    }).join('');
    
                    if (messageResult1C.length !== 0) {
    
                        return { messageResult1C };
    
                    } else {
    
                        messageResult1C = `${vendorCode} нигде не числится\n\n` // привязка к !findResult1C.toLowerCase().includes('нигде не числится') 
                        return { messageResult1C };
                    }
    
                } else {
    
                    console.log('В таблице нет данных');
                }
            } else {
    
                console.log('Не найденны строки в таблице');
            }
        }

    } catch (e) {
        console.log('Ошибка выполенния кода', e);
    }
}

// ======================================================================================================================================
// Функция проверки поставщика
// ======================================================================================================================================

const startCheckVendor = async (chatId, msg) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'brand', 'vendor']
    });

    await user.update({lastCommand: '/enterVC'}, {
        where: {
            chatId: chatId
        }
    })

    if (user.vendor !== null) {

        const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');

        // if (formatedUserVendor.includes('ОРАК')
        //     // formatedUserVendor.includes('ИНТЕРДЕКОР') ||
        //     // formatedUserVendor.includes('РИКСОР') 
        //     // formatedUserVendor.includes('КАДО') ||
        //     // formatedUserVendor.includes('АКУРА') ||
        //     // formatedUserVendor.includes('КОНТРАКТПЛЮС') ||
        //     // formatedUserVendor.includes('ГАЙДАРЬ') ||
        //     // formatedUserVendor.includes('ГЛОБАЛТЕКС') ||
        //     // formatedUserVendor.includes('БЕРНИНГХЭДС') ||
        //     // formatedUserVendor.includes('БЕКАРТТЕКСТИЛЬ') ||
        //     // formatedUserVendor.includes('АВТ') ||
        //     // formatedUserVendor.includes('МЕРКЬЮРИФОРДЖ') ||
        //     // formatedUserVendor.includes('ФАБРИКДЕКО') ||
        //     // formatedUserVendor.includes('ШИЛИН') ||
        //     // formatedUserVendor.includes('ENGLISCHDECOR') ||
        //     // formatedUserVendor.includes('ПОЛУНИЧЕВА') ||
        //     // formatedUserVendor.includes('ШЕВЧЕНКО') ||
        //     // formatedUserVendor.includes('ФОРПОСТ') ||
        //     // formatedUserVendor.includes('HOUSEOFJAB') ||
        //     // formatedUserVendor.includes('ЕВРОПЕЙСКИЕ') ||
        //     // formatedUserVendor.includes('БУНТИНА') ||
        //     // formatedUserVendor.includes('RUBELLI') ||
        //     // formatedUserVendor.includes('ОКНАРОСТА') ||
        //     // formatedUserVendor.includes('ЛОЙМИНА') ||
        //     // formatedUserVendor.includes('ЛИСОХМАРА') ||
        //     // formatedUserVendor.includes('ПОДРЕЗ') ||
        //     // formatedUserVendor.includes('РОБЕРТС') ||
        //     // formatedUserVendor.includes('ЮГАРТ') ||
        //     // formatedUserVendor.includes('ПРОТОС') ||
        //     // formatedUserVendor.includes('РУАЛЬЯНС') 
        // ) {
        //     return bot.sendMessage(
        //         chatId, 
        //         `Чтобы <b>отправить email</b>\n с запросом: остатков, срока поставки,\nа так же резервирования интересующей вас позиции бренда <b>${user.brand}</b>\n<b>Введите артикул искомого вами объекта:</b>`,
        //         { parse_mode: 'HTML' }
        //     );
        // } else 
        if (formatedUserVendor.includes('ОПУС')) {
            return bot.sendMessage(
                chatId, 
                `Чтобы <b>посмотреть остатки</b> на сайте\n<code>https://opusdeco.ru</code>\n<b>Введите артикул искомого вами объекта:</b>`,
                { parse_mode: 'HTML' }
            );
        } else if (formatedUserVendor.includes('ДЕКОРТРЕЙД')) {
            return bot.sendMessage(
                chatId, 
                `Чтобы <b>посмотреть остатки</b> на сайте\n<code>https://dealer.decaro.ru</code>\n<b>Введите артикул искомого вами объекта:</b>`,
                { parse_mode: 'HTML' }
            );
        } else if (formatedUserVendor.includes('ЛЕВАНТИН')) {
            return bot.sendMessage(
                chatId, 
                `Чтобы <b>посмотреть остатки</b> на сайте\n<code>http://www.galleriaarben.ru</code>\n<b>Введите артикул искомого вами объекта:</b>`,
                { parse_mode: 'HTML' }
            );

        } else if  (formatedUserVendor.includes('ДЕКОРДЕЛЮКС') ||
                    formatedUserVendor.includes('ОРАК') ||
                    formatedUserVendor.includes('ОРАК') ||
                    formatedUserVendor.includes('ДЕКОРРУС') ||
                    formatedUserVendor.includes('БАУТЕКС') ||
                    formatedUserVendor.includes('ЛОЙМИНА') ||
                    formatedUserVendor.includes('СИРПИ') ||
                    formatedUserVendor.includes('BRINK&CAMPMAN')
                ) {

            await bot.sendMessage(
                chatId,
                `Введите <b>артикул</b> или <b>наименование</b> искомого вами объекта:`,
                { parse_mode: 'HTML' }
            );
            botMsgIdx = msg.message_id += 1;
            return;  
        } else {
            return bot.sendMessage(
                chatId, 
                `К сожалению, мне ещё не разрешили работать с поставщиком бренда <b>${user.brand}</b>.`,
                { parse_mode: 'HTML' }
            );
        }
    } else {
        return bot.sendMessage(
            chatId, `Бренд не найден, проверьте соответсвие брендов в эксель файлах:\n<b>"Каталоги  распределение в салоны 26.09.19"</b>\n<b>"Текстиль Каталоги  распределение в салоны"</b>\nc эксель файлом <b>"Список прайслистов"</b>.`,
            { parse_mode: 'HTML' }
        );
    }
        
}

// ======================================================================================================================================
// Функция html запроса по данным из БД на сайт поставщика ОПУС
// ======================================================================================================================================

const startFindOpus = async (chatId) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'brand', 'vendorCode']
    });

    await user.update({lastCommand: '/enterVC'}, {
        where: {
            chatId: chatId
        }
    })

    try {

        //Формируем URL для поиска
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
                    availabilityContent += `${$$(names[0]).text()}: <code>${$$(cells[0]).text()}</code>\n`;
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
                    expectedArrivalContent += `${$$(names[0]).text()}: <code>${$$(cells[0]).text()}</code>\n`;
                    expectedArrivalContent += `${$$(names[1]).text()}: ${$$(cells[1]).text()}\n`;
                    expectedArrivalContent += `${$$(names[2]).text()}: ${$$(cells[2]).text()}\n`;
                    expectedArrivalContent += `${$$(names[3]).text()}: ${$$(cells[3]).text()}\n\n`;
                });
            });

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }

            // Проверяем наличие таблицы
            if (availabilityTable.length === 0) {

                if (expectedArrivalTable.length === 1) {
                    // Отправляем информацию о поставках товара
                    bot.sendMessage(chatId, `${expectedArrivalContent}`, startFindOptions);
                    console.log('информация о поставках при отсутсвии наличия, успешно отправлена');
                    return;

                } else {

                    // Отправляем сообщение о отсутствии товара
                    bot.sendMessage(chatId, 'В данный момент товар отсутствует на складе поставщика', startFind1Options);
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
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            bot.sendMessage(chatId, 'Товары не найдены. Проверьте правильное написание артикула и бренда.', startFind1Options);
            return;
        }

    } catch (e) {
        console.log('Ошибка при выполнении запроса', e);
        if (botMsgIdx !== null) {
            bot.deleteMessage(chatId, botMsgIdx);
            botMsgIdx = null;
        }
        return bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFind1Options);
    }
   
}

// ======================================================================================================================================
// Функция html запроса по данным из БД на сайт поставщика ДЕКОР ТРЕЙД
// ======================================================================================================================================

const startFindDecaro = async (chatId, msg) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'vendorCode']
    });

    await user.update({lastCommand: '/enterVC'}, {
        where: {
            chatId: chatId
        }
    })

    try {

        //Формируем URL для поиска
        const searchUrl = `https://dealer.decaro.ru/catalog/?q=${user.vendorCode}&s=Найти`;

        //Отправляем запрос на сайт
        const response = await axios.get(searchUrl);
        const $ = cheerio.load(response.data);

        const firstProductLink = $('div.item-title a').attr('href');

        if (firstProductLink) {
            
            const productResponse = await axios.get(`https://dealer.decaro.ru${firstProductLink}`);

            let $$ = cheerio.load(productResponse.data);
            const inner_props = $$('div.inner_props div.prop');
            const dataId = $$('div.availability-table').toString().trim().split('"')[3];
            let chars = ''; 

            
            // создаем массив объектов с данными из каждого элемента prop
            const propsData = inner_props.map((index, element) => {
                const rowsNames = $$(element).find('span');
                const rowsValue = $$(element).find('div.char_value');
                return {
                    name: rowsNames.text().trim(),
                    value: rowsValue.text().trim()
                }
            }).get(); // преобразуем объект Cheerio в обычный массив

            propsData.forEach((item) => {
                chars += `${item.name}: ${item.value}\n`;
            });
            
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            
            await bot.sendMessage(
                chatId,
                chars,
                { parse_mode: "HTML" }
            );
            
            await bot.sendMessage(
                chatId,
                `Идёт запрос на получение остатков и сроков поставки . . .`,
                { parse_mode: "HTML" }
            );
            botMsgIdx = msg.message_id += 2;
            
            const responseQty = await axios.post("https://dealer.decaro.ru/local/components/whatasoft/product.quantity/ajax.php", {
                    "id": `${dataId}`
                }, {
                    "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    }
                })

                let $ = cheerio.load(responseQty.data.data);
                const availabilityTable = $('div.availability-table-section .item');

                const availabilityTableValue = availabilityTable.map((index, element) => {

                    const rowsStatus = $(element).find('div.status');
                    const rowsDays = $(element).find('div.days');
                    const rowsDate = $(element).find('div.date');
                    const rowsArticul = $(element).find('div.articul');
                    const rowsQty = $(element).find('div.qty');
                    const rowsUnit = $(element).find('div.unit');
                    const rowsOther = $(element).find('small');

                    return {
                        status: rowsStatus.text().trim(),
                        days: rowsDays.text().trim(),
                        date: rowsDate.text().trim(),
                        articul: rowsArticul.text().trim(),
                        qty: rowsQty.text().trim(),
                        unit: rowsUnit.text().trim(),
                        other: rowsOther.text().trim()
                    }
                }).get(); // преобразуем объект Cheerio в обычный массив
            
                chars = '';
                console.log(availabilityTableValue);

                // выводим данные из каждого элемента массива propsData
                availabilityTableValue.forEach((item) => {

                    chars += `<b>${item.status}:</b> `;

                    if (item.days !== null && item.days !== undefined) {
                        chars += `${item.days}`;
                    }                    
                    if (item.date !== null && item.date !== undefined) {
                        chars += `${item.date}`;
                    }
                    if (item.articul !== null && item.articul !== undefined) {
                        chars += `<code>${item.articul}</code> `;
                    }
                    if (item.qty !== null && item.qty !== undefined) {
                        chars += ` ${item.qty} `;
                    }
                    if (item.unit !== null && item.unit !== undefined) {
                        chars += `${item.unit}\n`;
                    }

                    chars += `${item.other}\n`
                });

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }

            return bot.sendMessage(
                chatId,
                chars,
                startFindOptions
            );

        } else {

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                'Товары не найдены. Попробуйте ввести бренд вместе с артикулом, через пробел.\nИли введите полное наименование из карточки товара в 1С.', 
                startFind1Options
            );
        }

    } catch (e) {
        console.log('Ошибка при выполнении запроса', e);
        if (botMsgIdx !== null) {
            bot.deleteMessage(chatId, botMsgIdx);
            botMsgIdx = null;
        }
        return bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFind1Options);
    }
}

// ======================================================================================================================================
// Функция html запроса по данным из БД на сайт поставщика ЛЕВАНТИН
// ======================================================================================================================================

const startFindLevantin = async (chatId, msg) => {
    // lc = '/enterVC';
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'lastCommand', 'vendorCode']
    });

    await user.update({lastCommand: '/enterVC'}, {
        where: {
            chatId: chatId
        }
    })

    let formatedVendorCode = user.vendorCode.replace(/,/g, '').replace(/galleria|arben/gi, '');
    let counter = 0;

    while (formatedVendorCode.includes("  ") && counter < 3) {
      formatedVendorCode = formatedVendorCode.replace(/\s\s/g, ' ');
      counter++;
    }

    console.log(formatedVendorCode)

    try {

        const responseProduct = await axios.get(`http://www.galleriaarben.ru/catalog/exists/all/?arrFilterName=${formatedVendorCode.trim()}&set_filter=Y`);
        const $ = cheerio.load(responseProduct.data);

        const firstProductLink = $('div.row.catalog a').attr('href');

        if (firstProductLink) { 

            const responseAuth = await axios.post(`http://www.galleriaarben.ru/ajax/auth.php`, {
                backurl: `/ajax/auth.php`,
                AUTH_FORM: `Y`,
                TYPE: `AUTH`,
                Login: `Войти`,
                USER_LOGIN: `Manders`,
                USER_PASSWORD: `Manders`
            },{
                "headers": {
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                }
            });

            const cookies = responseAuth.headers['set-cookie'];
            console.log(`${responseAuth.data.trim()}`);
            
            const responseProductPage = await await axios.get(`http://www.galleriaarben.ru${firstProductLink}`, {
                headers: {
                  Cookie: cookies.join('; ') // передаем cookies в заголовке запроса
                }
            });

            const $$ = cheerio.load(responseProductPage.data);
            const availability = $$('.catalog-detail__available').text().trim();
            let message = '';

            // Извлекаем нужные строки
            const collection =  $$('.catalog-detail__header').text().trim();
            const title =  $$('.catalog-detail__title').eq(0).text().trim();
            const price =  $$('.catalog-detail__title').eq(1).text().trim();
            if (collection !== null) {
                message += `${collection}\n`;
            }
            if (title !== null) {
                message += `<b>${title}</b>\n`;
            }
            if (price !== null) {
                message += `${price}\n\n`;
            }

            // Извлекаем нужные строки из Блока характеристик
            const charsBlock = $$('.small-12.medium-6.large-8.columns.catalog-detail__text');

            const charsBlock1 = charsBlock.find('.row').eq(1);
            const charsBlock2 = charsBlock.find('.row').eq(2);

            charsBlock1.each((index, element) => {
                const everyRow = $(element).text().trim().replace(/\s+/g, ' ').replace(/\n+/g, '\n'); // Получаем текст строки и удаляем лишние пробелы
                message += `${everyRow}\n`;
            })

            message += `\n`;

            charsBlock2.each((row, index, element) => {
                const everyRow = $(index).text().trim().replace(/\s+/g, ' ').replace(/\n+/g, '\n'); // Получаем текст строки и удаляем лишние пробелы
                message += `${everyRow}\n`;
            })

            message += `\n`;
            message += `<b>В наличии:</b> ${availability.replace(/\s+/g, '')}\n\n`;
            message += `<i>можете ввести следующий артикул для поиска</i>`;

            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                message, 
                startFindOptions
            );

        } else {
        
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                'Товары не найдены. Попробуйте ввести бренд вместе с артикулом, через пробел.\nИли введите полное наименование из карточки товара в 1С.', 
                startFind1Options
            );
        }

    } catch (e) {

        console.log('Ошибка при выполнении запроса', e);
        if (botMsgIdx !== null) {
            bot.deleteMessage(chatId, botMsgIdx);
            botMsgIdx = null;
        }
        return bot.sendMessage(chatId, 'Произошла ошибка при выполнении запроса.', startFindOptions);
    }
}

// ======================================================================================================================================
// Функция отправки email с запросом на резервирование
// ======================================================================================================================================

const sendReserveEmail = async (chatId) => {

    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        },
        attributes: ['id', 'chatId', 'subject', 'textMail', 'email', 'vendorEmail']
    });
    
    // const recipient = `${user.vendorEmail}`;     // email поставщика
    const recipient = `${user.email}`;     // email поставщика
    // const copy = `purchasing_internal@manders.ru`;   //ВАЖНО: Ставить в копию только     purchasing_internal@manders.ru
    const copy = `n_kharitonov@manders.ru`;   //ВАЖНО: Ставить в копию только     purchasing_internal@manders.ru

    

    try {
        if (user.vendor !== null) {
            // const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');  На случай определения действий по поставщику

            let result = transporter.sendMail({
                from: 'zakupki_bot@manders.ru',
                to: `${recipient}, ${copy}, nick.of.darkwood@gmail.com`,
                subject: user.subject,
                text: user.textMail,
            });
            
            return bot.sendMessage(
                chatId, 
                `Сообщение с темой: \n<pre>"${user.subject}"</pre>\nуспешно отправлено поставщику и в отдел закупок.\n\nЧтобы узнать о состоянии резерва напишите письмо с вышеупомянутой темой на <b>purchasing_internal@manders.ru</b>.`, 
                beginWork2Options
            );
        }
        

    } catch (e) {
        console.error(e);
        throw new Error('Ошибка при отправке email');
    }
}

// ======================================================================================================================================
// Функция для поиска эксель файла
// ======================================================================================================================================

async function findExcelFile(
    fileNameWallpaper = '', 
    fileNameTextile = '', 
    fileNamePricelist = '',
    fileNameOracMSK = '', 
    fileNameOracSPB = '',
    fileNameDecorDelux = '',
    fileNameDecorRus = '',
    fileNameBautex = '',
    fileNameLoymina = '',
    fileNameSirpi = '',
    fileNameBrink = '',
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
                fileNameOracSPB,
                fileNameDecorDelux,
                fileNameDecorRus,
                fileNameBautex,
                fileNameLoymina,
                fileNameSirpi,
                fileNameBrink
                );

            if (result.fileNameWallpaper) {
                fileNameWallpaper = result.fileNameWallpaper;

            } else if (result.fileNameTextile) {
                fileNameTextile = result.fileNameTextile;

            } else if (result.fileNamePricelist) {
                fileNamePricelist = result.fileNamePricelist;

            } else if (result.fileNameOracMSK) {
                fileNameOracMSK = result.fileNameOracMSK;

            } else if (result.fileNameOracSPB) {
                fileNameOracSPB = result.fileNameOracSPB;

            } else if (result.fileNameDecorDelux) {
                fileNameDecorDelux = result.fileNameDecorDelux;

            } else if (result.fileNameDecorRus) {
                fileNameDecorRus = result.fileNameDecorRus;

            } else if (result.fileNameBautex) {
                fileNameBautex = result.fileNameBautex;

            } else if (result.fileNameLoymina) {
                fileNameLoymina = result.fileNameLoymina;

            } else if (result.fileNameSirpi) {
                fileNameSirpi = result.fileNameSirpi;

            } else if (result.fileNameBrink) {
                fileNameBrink = result.fileNameBrink;

            }

        } else if (path.extname(file) === '.xlsx') {
            
            if (file.toLowerCase().includes('каталоги_распределение_в_салоны_26_09_19')) {
                fileNameWallpaper = filePath;
            } else if (file.toLowerCase().includes('текстиль_каталоги_распределение_в_салоны')) {
                fileNameTextile = filePath;
            } else if (file.toLowerCase().includes('список_прайслистов')) {
                fileNamePricelist = filePath;
            } else if (file.toLowerCase().includes('orac_мск')) {
                fileNameOracMSK = filePath;
            } else if (file.toLowerCase().includes('orac_спб')) {
                fileNameOracSPB = filePath;
            } else if (file.toLowerCase().includes('баутекс')) {
                fileNameBautex = filePath;
            } else if (file.toLowerCase().includes('brink&campman')) {
                fileNameBrink = filePath;
            }
        } else if (path.extname(file) === '.xls') {

            if (file.toLowerCase().includes('декор_делюкс')) {
                fileNameDecorDelux = filePath;
            } else if (file.toLowerCase().includes('декор_рус')) {
                fileNameDecorRus = filePath;
            } else if (file.toLowerCase().includes('лоймина')) {
                fileNameLoymina = filePath;
            } else if (file.toLowerCase().includes('сирпи')) {
                fileNameSirpi = filePath;
            }
        }
        if (fileNameWallpaper && 
            fileNameTextile && 
            fileNamePricelist && 
            fileNameOracMSK &&
            fileNameOracSPB && 
            fileNameDecorDelux && 
            fileNameDecorRus &&
            fileNameBautex &&
            fileNameLoymina &&
            fileNameSirpi &&
            fileNameBrink
            ) {
            break;
        }
    }
    return { 
        fileNameWallpaper, 
        fileNameTextile, 
        fileNamePricelist, 
        fileNameOracMSK,
        fileNameOracSPB,
        fileNameDecorDelux,
        fileNameDecorRus,
        fileNameBautex,
        fileNameLoymina,
        fileNameSirpi,
        fileNameBrink
    };
}

// ======================================================================================================================================
// Функция поиска артикула ORAC
// ======================================================================================================================================

async function findOrac(chatId) {
        
    const resultMSK = await findExcelFile('orac_мск');
    const resultSPB = await findExcelFile('orac_спб');
    
    const filePathMSK = resultMSK.fileNameOracMSK;
    const filePathSPB = resultSPB.fileNameOracSPB;
    
    let messageORAC = '';
    
    const user = await UserModel.findOne({
        where: {
            chatId: chatId
        }
    });

    let vendorCode = user.vendorCode;
    const findResult1C = await startRequest1C(chatId, vendorCode);

    if (findResult1C) {

        messageORAC = `По данным 1С:\n${findResult1C.messageResult1C}\n\n`;
    } else {

        messageORAC += `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>\n\n`
    }

    if (filePathMSK) {

        try {
            
            const workbookMSK = new ExcelJS.Workbook();
            const streamMSK = fs.createReadStream(filePathMSK);
            const worksheetMSK = await workbookMSK.xlsx.read(streamMSK);
            const firstWorksheetMSK = worksheetMSK.worksheets[0];

            let foundMatchOracMSK = false;
            
            firstWorksheetMSK.eachRow( async (row, rowNumber) => {

                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim().replace(/[\u00A0]/g, ' ');
                const formatedUserVC = user.vendorCode.toString().trim();
                
                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracMSK = true;
            
                    const headerRow = firstWorksheetMSK.getRow(2);
                    let bValue, cValue;
            
                    headerRow.eachCell((cell, colNumber) => {
                        const headerCellValue = cell.value.toString().trim();
                        
                        if (headerCellValue === 'Ед. изм.') {
                            bValue = row.getCell(colNumber).value;
                        } else if (headerCellValue === 'Доступно') {
                            cValue = row.getCell(colNumber).value;
                        }
                    });
            
                    let a3Value = firstWorksheetMSK.getCell('A3').value; //Название склада
                    a3Value = a3Value.toString().split( "(" )[0];
            
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе ОРАК "<b>${a3Value}</b>"\n`;
            
                    if (bValue && cValue) {
                        messageORAC += `в количестве <b>${cValue}</b> <b>${bValue}</b>\n\n`;
                    }
            
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                }
            });

            if (!foundMatchOracMSK) {

                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }

                messageORAC += `На складе ОРАК в Москве артикул <b>${user.vendorCode}</b> отсутсвует.\n\n`;
            }

        } catch (error) {
            console.error(`Ошибка при чтении файла ${filePathMSK}:`, error); 
        }
    }

    if (filePathSPB) {

        try {

            const workbookSPB = new ExcelJS.Workbook();
            const streamSPB = fs.createReadStream(filePathSPB);
            const worksheetSPB = await workbookSPB.xlsx.read(streamSPB);
            const firstWorksheetSPB = worksheetSPB.worksheets[0];

            let foundMatchOracSPB = false;

            firstWorksheetSPB.eachRow( async (row, rowNumber) => {

                const cellValue = row.getCell('A').value; //Артикул
                const formatedCellValue = cellValue.toString().trim().replace(/[\u00A0]/g, ' ');
                const formatedUserVC = user.vendorCode.toString().trim();
                
                if (formatedCellValue === formatedUserVC) {
                    foundMatchOracSPB = true;
            
                    const headerRow = firstWorksheetSPB.getRow(2);
                    let bValue, cValue;
            
                    headerRow.eachCell((cell, colNumber) => {
                        const headerCellValue = cell.value.toString().trim();
                        
                        if (headerCellValue === 'Ед. изм.') {
                            bValue = row.getCell(colNumber).value;
                        } else if (headerCellValue === 'Доступно') {
                            cValue = row.getCell(colNumber).value;
                        }
                    });
            
                    let a3Value = firstWorksheetSPB.getCell('A3').value; //Название склада
                    a3Value = a3Value.toString().split( "(" )[0];
            
                    messageORAC += `Артикул <b>${cellValue}</b> имеется на складе ОРАК "<b>${a3Value}</b>"\n`;
            
                    if (cValue && bValue) {
                        messageORAC += `в количестве <b>${cValue}</b> <b>${bValue}</b>\n\n`;
                    }
            
                    if (botMsgIdx !== null) {
                        bot.deleteMessage(chatId, botMsgIdx);
                        botMsgIdx = null;
                    }
                }
            });
            
            if (!foundMatchOracSPB) {
                
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                
                messageORAC += `На складе ОРАК в Санкт-Петербурге артикул <b>${user.vendorCode}</b> отсутсвует.\n\n`;
            }
            
        } catch (error) {
            console.error(`Ошибка при чтении файла ${filePathSPB}:`, error); 
        }
    }
    messageORAC += `<strong><u>Если вы хотите заказать товар через 2 склада поставщика для 1ого клиента, то делайте 2 ЗАКАЗА ПОСТАВЩИКУ!!</u></strong>\n\n<strong>ВАЖНО</strong>: максимальный срок для возврата = НЕ более 5 месяцев (от даты доставки товара на наш склад)\n`;
    return bot.sendMessage(chatId, messageORAC, { parse_mode: "HTML" });
    
}

// ======================================================================================================================================
//Функция поиска каталога обоев
// ======================================================================================================================================

async function findCatalogWallpaper(chatId) {

    let fileNameWallpaper = 'Каталоги_распределение_в_салоны_26_09_19';
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

            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;

                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                    const formatedUserCatalog = user.catalog.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                    
                    if (formatedCellValue.includes(formatedUserCatalog)) {
                        foundMatchWallpaper = true;
                        let message = '';
                        
                        const bValue = row.getCell('B').value;
                        let cValue = row.getCell('C').value.toString();
                        const oValue = row.getCell('O').value;
                        const pValue = row.getCell('P').value;
                        const vendorCode = bValue;

                        await user.update({brand: cValue.toUpperCase()});
                        let findResult1C = await startRequest1C(chatId, vendorCode);
                        let PricelistLink = await findPricelistLink(chatId, cValue);


                        if (findResult1C) {
                            
                            let formatedMessageResult1C = findResult1C.messageResult1C.toLowerCase().includes('нигде не числится');
                            
                            if (!formatedMessageResult1C) {
    
                                const o1Value = firstWorksheet.getCell('O1').value;
                                const p1Value = firstWorksheet.getCell('P1').value;
    
                                message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в Manders:\n\n`;
    
                                if (findResult1C.messageResult1C) {
    
                                    message += `По данным 1С:\n${findResult1C.messageResult1C}\n`
                                }
    
                                if (oValue !== null) {
                                    message += `${o1Value}: ${oValue}\n`;
                                }
    
                                if (pValue !== null) {
                                    message += `${p1Value}: ${pValue}\n`;
                                }
    
                                message += `\n${PricelistLink.messagePrice}`;
                                message += `<i>при получении нескольких результатов скопируйте полное наименование НУЖНОГО ВАМ каталога и отправьте боту снова</i>`;
    
                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }
    
                                return bot.sendMessage(
                                    chatId, 
                                    message, 
                                    beginWork3Options
                                );
    
                            } else {
    
                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }
    
                                return bot.sendMessage(
                                    chatId, 
                                    `Каталога в салонах нет.\nОбратитесь к Юлии Скрибник за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n<code>+7 966 321-80-08</code>\n\n${PricelistLink.messagePrice}`,
                                    { parse_mode: 'HTML' }
                                );
                            }

                        } else {
                            
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }

                            return bot.sendMessage(
                                chatId, 
                                `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>`, 
                                { parse_mode: 'HTML' }
                            );
                        }

                    }
                }
            });

            if (!foundMatchWallpaper) {
                return null;
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
}

// ======================================================================================================================================
//Функция поиска каталога текстиля
// ======================================================================================================================================

async function findCatalogTextile(chatId) {

    let fileNameTextile = 'Текстиль_Каталоги_распределение_в_салоны';
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

            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;

                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                    const formatedUserCatalog = user.catalog.toString().replace(/[\s\u00A0]/g, '').toLowerCase();
                
                    if (formatedCellValue.includes(formatedUserCatalog)) {
                        foundMatchTextile = true;
                        let message = '';

                        const bValue = row.getCell('B').value;
                        let cValue = row.getCell('C').value.toString();
                        const pValue = row.getCell('P').value;
                        const vendorCode = bValue;

                        await user.update({brand: cValue.toUpperCase()});
                        let findResult1C = await startRequest1C(chatId, vendorCode);
                        let PricelistLink = await findPricelistLink(chatId, cValue);

                        if (findResult1C) {
                            
                            let formatedMessageResult1C = findResult1C.messageResult1C.toLowerCase().includes('нигде не числится');

                            if (!formatedMessageResult1C) {
    
                                const p1Value = firstWorksheet.getCell(`P1`).value;
    
                                message += `<b>${cellValue.trim()}</b> бренда <b>${cValue.toUpperCase()}</b> имеется в Manders:\n`;
    
                                if (findResult1C.messageResult1C) {
    
                                    message += `По данным 1С:\n${findResult1C.messageResult1C}\n`
                                }
    
                                if (pValue !== null) {
                                    message += `${p1Value}: ${pValue}\n`;
                                }
                                
                                message += `\n${PricelistLink.messagePrice}`;
                                message += `<i>при получении нескольких результатов скопируйте полное наименование НУЖНОГО ВАМ каталога и отправьте боту снова</i>`;
                                
                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }
                                
                                await bot.sendMessage(
                                    chatId, 
                                    message, 
                                    beginWork3Options
                                );

                            } else {

                                if (botMsgIdx !== null) {
                                    bot.deleteMessage(chatId, botMsgIdx);
                                    botMsgIdx = null;
                                }

                                return bot.sendMessage(
                                chatId, 
                                `Каталога в салонах нет.\nОбратитесь к Юлии Скрибник за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n<code>+7 966 321-80-08</code>\n\n${PricelistLink.messagePrice}`, 
                                { parse_mode: 'HTML' }
                                );
                            }

                        } else {

                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }

                            return bot.sendMessage(
                                chatId, 
                                `Подключение к 1С временно недоступно\n<i>это норма во внерабочее время магазинов</i>`, 
                                { parse_mode: 'HTML' }
                            );
                        }
                    }
                }
            });

            if (!foundMatchTextile) {
                return null;
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
}

// ======================================================================================================================================
//Функция поиска ссылки на прайслист
// ======================================================================================================================================

async function findPricelistLink(chatId, cValue) {

    let fileNamePricelist = 'cписок_прайслистов';

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
            let vendor = '';

            firstWorksheet.eachRow((row, rowNumber) => {
                const cellValue = row.getCell('B').value;
                if (cellValue !== null) {

                    const formatedCellValue = cellValue.toString().toUpperCase().replace(/[\s-&]/g, '');
                    const formaterdCValue = cValue.toString().toUpperCase().replace(/[\s-&]/g, '');
    
                    if (formatedCellValue.includes(formaterdCValue)) {
                        foundMatchPricelist = true;

                        const aValue = row.getCell('A').value;  // Поставщик
                        let bValue = row.getCell('B').value;  // Бренд
                        const cValue = row.getCell('C').value;  // Ссылка на прайслист
                        const dValue = row.getCell('D').value;  // почтовый ящик поставщика
                        user.update({vendor: aValue.toUpperCase()});
                        vendor = aValue.toUpperCase();
                        if (dValue !== null) {
                        user.update({vendorEmail: dValue.toLowerCase()});
                        }
                        if (isNaN(bValue)) {
                            bValue = bValue.toUpperCase();
                        }

                        if (cValue !== null ) {
                            user.update({brand: bValue});
                            const formattedCValue = cValue.toString().replace(/\\/g, '\\');
                            messagePrice += `Ссылка на папку с прайс-листом бренда <b>${bValue}</b>:\n<code>${formattedCValue}</code>\n\n`;
                        } else {
                            user.update({brand: bValue});
                            messagePrice += `Я пока не знаю в какой папке лежит прайс-лист бренда <b>${bValue}</b>.😢\nЗапросите прайсы в отделе закупок.\n\n`
                        }
                    }
                }
            });

            if (!foundMatchPricelist) {
                user.update({vendor: null});
                vendor = null;
                messagePrice += `Прайс-лист по бренду <b>${user.brand}</b> в локальных файлах не найден.\nЗапросите прайсы в отделе закупок.`;
            }

            return {messagePrice, vendor};
        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику ДЕКОРДЕЛЮКС
// ======================================================================================================================================

async function findDecorDelux(chatId) {

    let fileNameDecorDelux = 'остатки_декор_делюкс';

    const result = await findExcelFile(fileNameDecorDelux);
    const filePath = result.fileNameDecorDelux;


    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {
                if (cellAddress[0] === '!') continue;
              
                const cellValue = firstWorksheet[cellAddress].v;

                console.log(cellAddress)

                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim();
                    const formatedUserVC = user.vendorCode.toString().trim();
              
                    if (isNaN(formatedCellValue)) {
                      formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;
                    
                        const gValue = firstWorksheet['G' + cellAddress.substring(1)].v; // Номенкулатура
                        const hValue = firstWorksheet['H' + cellAddress.substring(1)].v; // Серия\Партия
                        const iCell = firstWorksheet['I' + cellAddress.substring(1)];   // Ячейка: Свободный остаток
                        let iValue = {};
                    
                        if (iCell && iCell.v !== undefined) {
                          iValue = iCell.v; // Свободный остаток
                        } else {
                          iValue = '0';
                        }
                    
                        if (botMsgIdx !== null) {
                          bot.deleteMessage(chatId, botMsgIdx);
                          botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId, 
                            `<strong>${gValue}</strong>\nПартия: ${hValue}\n${iValue} шт в свободном остатке\n<i>можете ввести следующий артикул для поиска</i>`,
                            startFindOptions
                        );
                    }
                }
            }
            
            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${user.vendorCode} в файле "остатки_декор_делюкс" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    { parse_mode: 'HTML' }
                );
            }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }
    }
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику ДЕКОРРУС
// ======================================================================================================================================

async function findDecorRus(chatId) {

    let fileNameDecorRus = 'остатки_декор_рус';

    const result = await findExcelFile(fileNameDecorRus);
    const filePath = result.fileNameDecorRus;
    console.log(filePath);
    
    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });
        
        try { 
            
            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {

                if (cellAddress[0] === '!') continue;
        
                const cellValue = firstWorksheet[cellAddress].v;
        
                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim();
                    const formatedUserVC = user.vendorCode.toString().trim();
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }
        
                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;
                        
                        const bValue = firstWorksheet['B' + cellAddress.substring(1)].v; // Характеристика номенклатуры
                        const cCell = firstWorksheet['C' + cellAddress.substring(1)]; // Ячейка: Свободный остаток в ед. хранения остатков
                        let cValue = {};
                        
                        if (cCell && cCell.v !== undefined && cCell.v !== null) {
                            cValue = `${cCell.v} ед.`; // Свободный остаток в ед. хранения остатков
                        } else {
                            cValue = '0';
                        }
                        
                        const dCell = firstWorksheet['D' + cellAddress.substring(1)]; // Ячейка: Цена (руб.)
                        let dValue = {};
                        
                        if (dCell && dCell.v !== undefined && dCell.v !== null) {
                            dValue = `${dCell.v} руб.`; // Цена (руб.)
                        } else {
                            dValue = 'неизвестно';
                        }
                        
                        let message = '';
                        message += `<strong>${bValue}</strong>\n<pre>Свободный остаток:\t${cValue}</pre>\n`;

                        // Проверяем каждую ячейку после bValue на наличие пробела
                        for (let i = parseInt(cellAddress.substring(1)) + 1; ; i++) {
                          const currentBCell = firstWorksheet['B' + i];
                            let currentCCell = firstWorksheet['C' + i];

                            if (currentBCell && currentBCell.v && !currentBCell.v.toString().includes(' ')) {

                                if (currentCCell === undefined || currentCCell === null) {
                                    currentCCell = `0`;
                                }
                                const currentValue = `Партия: ${currentBCell.v}\t\t${currentCCell.v} ед.`;
                                message += `<code>${currentValue}</code>\n`;
                            } else {
                              break;
                            }
                        }
                        message += `Цена: ${dValue}\n<i>можете ввести следующий артикул для поиска</i>\n`;

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        
                        return bot.sendMessage(
                          chatId, 
                          message,
                          startFindOptions
                        );
                    }

                }
            };

            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                };
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${formatedUserVC} в файле "остатки_декор_рус" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    { parse_mode: 'HTML' }
                );
            }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }    
    }
        
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику БАУТЕКС
// ======================================================================================================================================

async function findBautex(chatId) {

    let fileNameBautex = 'остатки_баутекс';

    const result = await findExcelFile(fileNameBautex);
    const filePath = result.fileNameBautex;
    console.log(filePath);
    
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

            let foundMatch = false;
            
            firstWorksheet.eachRow( async (row, rowNumber) => {
                const cellValue = row.getCell('D').value;
                if (cellValue !== null) {
                    
                    const formatedCellValue = cellValue.toString().toUpperCase().replace(/[\s-&]/g, '');
                    const formatedUserVC = user.vendorCode.toString().toUpperCase().replace(/[\s-&]/g, '');
                    
                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;
                        
                        let message = '';
                        const dValue = row.getCell('D').value;  // номенкулатура
                        
                        const j8Value = firstWorksheet.getCell('J8').value;  // Склад 1
                        let jValue = row.getCell('J').value;  // Значение
                        const lValue = row.getCell('L').value;  // ед. измерения

                        const m8Value = firstWorksheet.getCell('M8').value;  // Склад 2
                        let mValue = row.getCell('M').value;  // Значение
                        const nValue = row.getCell('N').value;  // ед. измерения

                        const o8Value = firstWorksheet.getCell('O8').value;  // Склад 3
                        let oValue = row.getCell('O').value;  // Значение
                        const qValue = row.getCell('Q').value;  // ед. измерения

                        const r8Value = firstWorksheet.getCell('R8').value;  // Склад 4
                        let rValue = row.getCell('R').value;  // Значение
                        const sValue = row.getCell('S').value;  // ед. измерения

                        message += `<b>${dValue}</b>\n\n`;

                        if (jValue !== null && jValue.formula) {
                            jValue = jValue.result;
                            message += `${j8Value}\n${jValue} ${lValue}\n\n`;

                        } else if (jValue !== null) {
                            message += `${j8Value}\n${jValue} ${lValue}\n\n`;
                        }

                        if (mValue !== null && mValue.formula) {
                            mValue = mValue.result;
                            message += `${m8Value}\n${mValue} ${nValue}\n\n`;

                        } else if (mValue !== null) {
                            message += `${m8Value}\n${mValue} ${lValue}\n\n`;
                        }

                        if (oValue !== null && oValue.formula) {
                            oValue = oValue.result;
                            message += `${o8Value}\n${oValue} ${qValue}\n\n`;

                        } else if (oValue !== null) {
                            message += `${o8Value}\n${oValue} ${lValue}\n\n`;
                        }

                        if (rValue !== null && rValue.formula) {
                            rValue = rValue.result;
                            message += `${r8Value}\n${rValue} ${sValue}\n\n`;

                        } else if (rValue !== null) {
                            message += `${r8Value}\n${rValue} ${lValue}\n\n`;
                        }

                        message += `<i>можете ввести следующий артикул для поиска</i>\n\n`;
                        
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        await bot.sendMessage(
                            chatId, 
                            message,
                            startFindOptions
                        );
                    }
                }
            });

            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${user.vendorCode} в файле "остатки_баутекс" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    { parse_mode: 'HTML' }
                );
            }

        } catch (error) {
            console.error('Ошибка при чтении файла Excel:', error);
        }
    }
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику ЛОЙМИНА
// ======================================================================================================================================

async function findLoymina(chatId) {

    let fileNameLoymina = 'остатки_лоймина';

    const result = await findExcelFile(fileNameLoymina);
    const filePath = result.fileNameLoymina;
    console.log(filePath);

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {

                if (cellAddress[0] === '!') continue;
        
                const cellValue = firstWorksheet[cellAddress].v;

                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim().replace(/[\s\u00A0,]/g, '');
                    const formatedUserVC = user.vendorCode.toString().trim().replace(/[\s\u00A0,]/g, '');
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;

                        const dValueCell = firstWorksheet['D' + cellAddress.substring(1)];
                        let dValue = '';
                        const kValueCell = firstWorksheet['K' + cellAddress.substring(1)];
                        let kValue = '';
                        const jValueCell = firstWorksheet['J' + cellAddress.substring(1)];
                        let jValue = '';

                        if (dValueCell !== null && dValueCell !== undefined) {
                            dValue = dValueCell.v;    // Партия
                        }
                        if (kValueCell !== null && kValueCell !== undefined) {
                            kValue = kValueCell.v     // Колличество
                        }
                        if (jValueCell !== null && jValueCell !== undefined) {
                            jValue = jValueCell.v     // Ед. измерения
                        }

                        let message = '';
                        message += `<b>${dValue}</b>\n`;
                        message += `В наличии: <b>${kValue}</b> `;
                        message += `<b>${jValue}</b>\n`;
                            
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        message += `\n<i>можете ввести следующий артикул для поиска</i>\n`;

                        await bot.sendMessage(
                            chatId, 
                            message,
                            startFindOptions
                        );
                    };
                }
            }

            if (!foundMatch) {
                if (botMsgIdx !== null) {
                    bot.deleteMessage(chatId, botMsgIdx);
                    botMsgIdx = null;
                }
                return bot.sendMessage(
                    chatId,
                    `Совпадения с артикулом ${user.vendorCode} в файле "остатки_лоймина" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                    { parse_mode: 'HTML' }
                );
            }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId, 
                `Ошибка при чтении файла ${filePath}.`
            );
        }
    }
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику СИРПИ
// ======================================================================================================================================

async function findSirpi(chatId) {

    let fileNameSirpi = 'остатки_сирпи';

    const result = await findExcelFile(fileNameSirpi);
    const filePath = result.fileNameSirpi;
    console.log(filePath);

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;

            for (let cellAddress in firstWorksheet) {
                
                if (cellAddress[0] === '!') continue;

                const cellValue = firstWorksheet[cellAddress].v;
        
                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim().replace(/[\s]/g, '');
                    const formatedUserVC = user.vendorCode.toString().trim().replace(/[\s]/g, '');
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;
                        let message = '';

                        const aValue = firstWorksheet['A' + cellAddress.substring(1)].v; // Номенкулатура
                        message += `<b>${aValue}</b>\n\n`;

                        const cCell = firstWorksheet['C' + cellAddress.substring(1)]; // Доступно
                        if (cCell && cCell.v !== null && cCell.v !== undefined) {
                            message += `Доступно сейчас: ${cCell.v}\n`
                        }

                        const d1Value = firstWorksheet['D1'].v; // Дата поставки 1
                        const dCell = firstWorksheet['D' + cellAddress.substring(1)]; // колличество в поставке 1
                        if (dCell && dCell.v !== null && dCell.v !== undefined) {
                            message += `Дата след. поставки:\n${d1Value}\n\nБудет доступно ${dCell.v}\n`
                        }

                        let e1Value = firstWorksheet['E1'].v; // Дата поставки 2
                        const eCell = firstWorksheet['E' + cellAddress.substring(1)]; // колличество в поставке 2
                        if (eCell && eCell.v !== null && eCell.v !== undefined) {
                            message += `Дата след. поставки:\n${e1Value}\nБудет доступно ${eCell.v}\n`
                        }

                        const f1Value = firstWorksheet['F1'].v; // Дата поставки 2
                        const fCell = firstWorksheet['F' + cellAddress.substring(1)]; // колличество в поставке 3
                        if (fCell && fCell.v !== null && fCell.v !== undefined) {
                            message += `Дата след. поставки:\n${f1Value}\nБудет доступно ${fCell.v}\n`
                        }

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        return bot.sendMessage(
                            chatId, 
                            message,
                            startFindOptions
                        );
                        
                    }
                }
            }

        if (!foundMatch) {
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId,
                `Совпадения с артикулом ${user.vendorCode} в файле "остатки_сирпи" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                { parse_mode: 'HTML' }
            );
        }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }
    }
}

// ======================================================================================================================================
// Функция поиска остатков по поставщику BRINK
// ======================================================================================================================================


async function findBrink(chatId) {

    let fileNameBrink = 'остатки_brink&campman';

    const result = await findExcelFile(fileNameBrink);
    const filePath = result.fileNameBrink;

    if (filePath) {

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            const workbook = XLSX.readFile(filePath);
            const firstWorksheet = workbook.Sheets[workbook.SheetNames[0]];

            let foundMatch = false;
            let message = '';

            for (let cellAddress in firstWorksheet) {
                
                if (cellAddress[0] === '!') continue;

                const cellValue = firstWorksheet[cellAddress].v;
        
                if (cellValue !== null) {
                    let formatedCellValue = cellValue.toString().trim().replace(/[\s]/g, '');
                    const formatedUserVC = user.vendorCode.toString().trim().replace(/[\s]/g, '');
        
                    if (isNaN(formatedCellValue)) {
                        formatedCellValue = formatedCellValue.toUpperCase();
                    }

                    if (formatedCellValue.includes(formatedUserVC)) {
                        foundMatch = true;

                        const bValue = firstWorksheet['B' + cellAddress.substring(1)].v;    // Номенкулатура
                        const cCell = firstWorksheet['C' + cellAddress.substring(1)];   // Ячейка EAN штрихкода 
                            let cValue = {};    // EAN штрихкод 

                            if (cCell && cCell.v !== undefined) {
                                cValue = cCell.v.toString();    // EAN штрихкод 
                            } else {
                                cValue = 'нет';
                            }

                        const fValue = firstWorksheet['F' + cellAddress.substring(1)].v;    // Свободный остаток в наличии на складе
                        let fDate = firstWorksheet['F1'].v.split(" ")[3];   // Дата свободного остатка

                            if ( !isNaN(fDate) ) {
                                const year = fDate.substring(0, 4);
                                const month = fDate.substring(4, 6);
                                const day = fDate.substring(6, 8);
                                fDate = `${day}.${month}.${year}`;
                            }

                        message += `Остаток <b>${bValue}</b> на <b>${fDate}</b>:\nEAN: ${cValue}\n\nСвободный остаток на складе: ${fValue}\n\n`;

                        const gCell = firstWorksheet['G' + cellAddress.substring(1)];   // Дата следующей поставки
                            let gValue = {};

                            if (gCell && gCell.v !== undefined) {
                                gValue = gCell.v.toString();                                   
                            } else {
                                gValue = 'неизвестна';
                            }

                            if ( !isNaN(gValue) ) {
                                const year = gValue.substring(0, 4);
                                const month = gValue.substring(4, 6);
                                const day = gValue.substring(6, 8);
                                gValue = `${day}.${month}.${year}`;
                            }
                            
                        message += `Дата следующей поставки: ${gValue}\n`;

                        const hCell = firstWorksheet['H' + cellAddress.substring(1)];   // Ячейка свободного остатка товара в пути
                            let hValue = {};

                            if (hCell !== undefined) {
                                hValue = hCell.v.toString();    // Свободный остаток товаров в пути 
                                message += `Свободный остаток товара в пути: ${hValue} ед.\n`;
                            }
                        
                        message += `\n<i>можете ввести следующий артикул для поиска</i>`
                        
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        return bot.sendMessage(
                            chatId, 
                            message,
                            startFind1Options
                        );
                    }
                }
            }

        if (!foundMatch) {
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(
                chatId,
                `Совпадения с артикулом ${user.vendorCode} в файле "остатки_сирпи" не найденны.\n<i>можете ввести следующий артикул для поиска</i>`,
                { parse_mode: 'HTML' }
            );
        }

        } catch (e) {
            console.log(e);
            if (botMsgIdx !== null) {
                bot.deleteMessage(chatId, botMsgIdx);
                botMsgIdx = null;
            }
            return bot.sendMessage(chatId, `Ошибка при чтении файла ${filePath}.`);
        }
    }
}

module.exports = { 
    readConfig, 
    createNewUser, 
    chekPassword,
    editEmail, 
    editNickname, 
    startRequest1C,
    startCheckVendor, 
    startFindOpus, 
    startFindDecaro,
    startFindLevantin, 
    sendReserveEmail, 
    findExcelFile, 
    findOrac, 
    findCatalogWallpaper, 
    findCatalogTextile,
    findPricelistLink, 
    findDecorDelux, 
    findDecorRus,
    findBautex, 
    findLoymina, 
    findSirpi,
    findBrink
};