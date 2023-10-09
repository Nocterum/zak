const TelegramApi = require('node-telegram-bot-api');
const path = require('./functions');
const fs = require('./functions');

const xlsjs = require('xlsjs'); //
const FormData = require('form-data');  //
const tough = require('tough-cookie');  //
const { axiosCookieJarSupport } = require('axios-cookiejar-support');   //

//ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
chats = {};

botMsgIdx = {};    //айди последнего сообщения от бота
sorry = 'Извините, я этому пока ещё учусь😅\nПрошу вас, обратитесь с данным запросом к\npurchasing_internal@manders.ru';

//ИМПОРТЫ
const {mainMenuOptions, gameOptions, againOptions, resetOptions, resetInfoWorkOptions,
    workOptions, work1Options, checkVendorOptions, startFindOptions, startFind1Options, startFind2Options, 
    beginWorkOptions, beginWork2Options, mainMenuReturnOptions, settingsOptions, 
    enterReserveNumberOptions, sendReserveOptions, beginWork3Options} = require('./options');
    const sequelize = require('./db');
    const UserModel = require('./models');
    const {transporter} = require('./nodemailer');
    const clientRDP = require('./rdp');
    const nodemailer = require('./nodemailer');
    const { readConfig,
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
            findBrink } = require('./functions.js');
    
    

const token = '6076442091:AAGUxzIT8C7G7_hx4clixZpIi0Adtb2p2MA';

    // const bot_token = config.bot_token;

    const bot = new TelegramApi(token, {
        polling: {
            interval: 300, //между запросами с клиента на сервер тг "млсек"
            autoStart: true, //обработка всех команд отправленных до запуска программы
            params: {
                timeout:10 //таймаут между запросами "млсек"
            }
        }
    });


//МЕНЮ КОМАНД
bot.setMyCommands([
    {command: '/mainmenu', description:'Главное меню'},
    {command: '/abilitys', description:'Актуальные функции бота'},
    {command: '/updatelist', description:'Список обновлений'},
    {command: '/settings', description:'Настройки'},
])

// ======================================================================================================================================
//СТАРТ РАБОТЫ ПРОГРАММЫ=================================================================================================================
// ======================================================================================================================================

const start = async () => {
    console.log('Бот запщуен...')

    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Подключение к базе данных установленно');
    } catch(err) {
        console.log('Подключение к базе данных сломалось', err);
    }

    // команды======================================================================================

    //старт
    bot.onText(/\/start/, async msg => {
        const chatId = msg.chat.id;
        var user = null;

        try {

            user = await UserModel.findOne({
                where: {
                    chatId: chatId
                }
            });

            if (user) {

                if (user.email !== '/passwordcheck') {

                    // lc = null
                    await user.update({lastCommand: null}, {
                        where: {
                            chatId: chatId
                        }
                    })
                
                    return bot.sendMessage(
                        chatId, 
                        `Ты ${user.firstName}, Я - Зак, мы уже знакомы 😅`
                    );
                }

            } else {

                await createNewUser(chatId, msg);

                return bot.sendMessage(
                    chatId, 
                    `Введите пароль:`
                );
            }
        
        } catch (e) {
        console.log('Ошибка при создании нового пользователя', e);
        }

    });

    // начать игру
    bot.onText(/\/game/, async msg => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            // lc = '/game';
            await user.update({lastCommand: '/game'}, {
                where: {
                    chatId: chatId
                }
            })

            const randomNumber = Math.floor(Math.random() * 10)
            chats[chatId] = randomNumber;
            return bot.sendMessage(
                chatId, 
                `Отгадай число😏`, 
                gameOptions
            );
        }
    });

    // для тестирования
    bot.onText(/\/x/, async msg => {
        const chatId = msg.chat.id;

        const config = await readConfig();

        // lc = null; 
        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand']
        });

        await user.update({lastCommand: null}, {
            where: {
                chatId: chatId
            }
        })

        return bot.sendMessage(chatId,
            `${config.bot_token},
            ${config.bot_password},
            ${config.data_base_login},
            ${config.data_base_password},
            ${config.mail_bot_host},
            ${config.mail_bot_user},
            ${config.mail_bot_password},
            ${config.url_manders_1C}`)
    });

    // настройки пользователя
    bot.onText(/\/settings/, async msg => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            // lc = null; 
            await user.update({lastCommand: null}, {
                where: {
                    chatId: chatId
                }
            })
        
            return bot.sendMessage(
                chatId, 
                `Настройки:`, 
                settingsOptions
            );
        }
    });

    // получение имена файлов 
    bot.onText(/\/files/, async msg => {
        const chatId = msg.chat.id;
        const folderPath = '/root/zak/xl';

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            // Получение списка файлов в папке
            fs.readdir(folderPath, async (err, files) => {
                if (err) {
                    console.log(err);
                    return bot.sendMessage(chatId, 'Произошла ошибка при получении списка файлов.');
                }
            
                // Отправка списка файлов
                await bot.sendMessage(chatId, 'Список файлов:');
                files.forEach((file) => {
                    return bot.sendMessage(chatId, `<code>${file}</code>`, { parse_mode: 'HTML' } );
                });
            });
        }
    });

    // получение конкретного файла
    bot.onText(/\/getfile (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            const fileName = match[1];
            const filePath = path.join('/root/zak/xl', fileName);

            // Проверка существования файла
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    return bot.sendMessage(chatId, 'Файл не найден.');
                }
            
                // Отправка файла
                bot.sendDocument(chatId, filePath);
            })
        }
    });

    // получение списка пользователей
    bot.onText(/\/whoiswho/, async (msg) => {
        const chatId = msg.chat.id;

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            },
            attributes: ['id', 'chatId', 'lastCommand', 'email']
        });

        if (user.email !== '/passwordcheck') {

            UserModel.findAll().then((users) => {

                users.forEach((user) => {
                const message = `ID: <code>${user.chatId}</code>\nEmail: <code>${user.email}</code>`;
                    bot.sendMessage(msg.chat.id,
                        message,
                        { parse_mode: 'HTML' }
                    );
                });
            }).catch((error) => {
              console.error('Ошибка при получении пользователей.:', error);
            });
        }
    });

    // получение списка пользователей
    bot.onText(/\/abilitys/, (msg) => {
        const chatId = msg.chat.id;

    bot.sendMessage(chatId,
    `<b>Что умеет бот сейчас:</b>

    Производить поиск 🔎 остатков на сайтах:
    <strong>opusdeco.ru</strong>
        ✅<code>1838                  ✅Arlin</code>
        ✅<code>Arthouse              ✅Atelier</code>
        ✅<code>Aura                  ✅Lincrusta</code>
        ✅<code>Print 4               ✅Sangiorgio</code>
        ✅<code>Sem - Murale          ✅York</code>

    <strong>dealer.decaro.ru</strong> 
        ✅<code>Architector           ✅Casa Mia</code>
        ✅<code>Coordonne             ✅Emil & Hugo</code>
        ✅<code>Epoca                 ✅Etten</code>
        ✅<code>Heritage House        ✅Jaima Brown</code>
        ✅<code>KT-Exсlusive          ✅Mayflower</code>
        ✅<code>NLXL                  ✅Paper & Ink</code>
        ✅<code>Seabrook              ✅Texam</code>
        ✅<code>Tiffany Design        ✅Trendsetter</code>
        ✅<code>Vatos                 ✅Wallquest</code>

    <strong>galleriaarben.ru</strong>
        ✅<code>Galleria Arben</code>

    <b>Производить поиск 🔎 по файлам остатков следующих брендов:</b>
        ✅<code>Architects Papers     ✅ARTE</code>
        ✅<code>Bautex                ✅Bluebellgray</code>
        ✅<code>BN International      ✅Brink</code>
        ✅<code>Collins & Company     ✅Eijffinger</code>
        ✅<code>Holden                ✅Hookedonwalls</code>
        ✅<code>Jannelli & Volpi      ✅Khroma Zoom</code>
        ✅<code>Loymina               ✅Milassa</code>
        ✅<code>Missoni               ✅Nina Hancock</code>
        ✅<code>ORAC                  ✅Swiss Lake</code>
        ✅<code>Ted Beker             ✅Wedgwood</code>

    <b>Отправлять емейлы поставщику</b> 📨
    <b>Подсказывать путь к папке с прайслистами</b> 👓
    <b>Искать каталоги обоев и текстиля</b> 🔎
    <b>Искать остатки в 1С*</b> ☑
    <i>*общее колличество</i>`,
            { parse_mode: 'HTML' }
        );
    });

    // обновления
    bot.onText(/\/updatelist/, (msg) => {
        const chatId = msg.chat.id;

    bot.sendMessage(chatId,
    `<b>Версия 1.0.4.0
    Что нового:</b>

    Бот настроен на отправку емейлов поставщику и в отдел закупок;
    Поиск по остаткам ОРАК сделан более надёжным;
    Обнавлён список актуальных функций бота;
    Улучшение безопасности;
    ------------------------------------
    <b>Версия 1.0.2.4
    Что нового:</b>

    упрощен процесс "знакомства с ботом";
    улучшена система поиска каталогов
        -теперь бот смотрит только на остатки в 1С
        -функция поиска по каталогам обоев
        и каталогам текстиля запускаются параллельно
        -приняты все подстраховочные меры при
        отстутсвия соединения с 1С (вызывало ошибку);

    упрощенно редактирование емейла и никнейма ;
    отредактирован текст, устранены опечатки;
    ------------------------------------
    `,
            { parse_mode: 'HTML' }
        );
    });

    //слушатель сообщений==========================================================================================

    bot.on('message', async msg => {
        let text = msg.text;
        const chatId = msg.chat.id;

        console.log(msg)

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

            if (user) {

                if (msg.document) {
                    let file_name = msg.document.file_name;

                    if (file_name.toLowerCase().includes('каталоги') ||
                        file_name.toLowerCase().includes('прайслистов')
                        ) {

                        let fileName = {};
                        if (file_name.toLowerCase().includes('26') && 
                            file_name.toLowerCase().includes('каталоги')
                            ) {
                            fileName = `каталоги_распределение_в_салоны_26_09_19.xlsx`;
                        }
                        if (file_name.toLowerCase().includes('текстиль') &&
                            file_name.toLowerCase().includes('каталоги')
                            ) {
                            fileName = `текстиль_каталоги_распределение_в_салоны.xlsx`;
                        }
                        if (file_name.toLowerCase().includes('прайслистов')) {
                            fileName = `список_прайслистов.xlsx`;
                        }

                        await bot.getFile(msg.document.file_id).then((file) => {

                            const fileStream = bot.getFileStream(file.file_id);
                            fileStream.pipe(fs.createWriteStream(`/root/zak/xl/${fileName}`));

                            fileStream.on('end', () => {
                                bot.sendMessage(
                                    chatId, 
                                    `Файл <b>${fileName}</b>\nуспешно сохранен.`, 
                                    { parse_mode: 'HTML' }
                                );
                            });
                        });
                        return;

                    // Сохранение файлов остатков. Обрезка дат, нижний регистр, замена пробелов на "_"
                    } else if (file_name.toLowerCase().includes('orac') || 
                                file_name.toLowerCase().includes('brink') ||
                                file_name.toLowerCase().includes('орак') ||
                                file_name.toLowerCase().includes('делюкс') ||
                                file_name.toLowerCase().includes('рус') ||
                                file_name.toLowerCase().includes('баутекс') ||
                                file_name.toLowerCase().includes('лоймина') ||
                                file_name.toLowerCase().includes('сирпи') ||
                                file_name.toLowerCase().includes('delux') ||
                                file_name.toLowerCase().includes('rus') ||
                                file_name.toLowerCase().includes('bautex') || 
                                file_name.toLowerCase().includes('loymina') ||
                                file_name.toLowerCase().includes('sirpi') ||
                                file_name.toLowerCase().includes('campman') 
                            ) {

                            let fileName = {};
                            file_name = file_name.replace(/\s\d+|\.\d+/g, '');  // удаление дат
                            let file_format = file_name.split(".")[1];  // определение формата файла
                            
                            if ( (file_name.toLowerCase().includes('orac') || 
                                    file_name.toLowerCase().includes('орак')) &&
                                (file_name.toLowerCase().includes('msk') || 
                                    file_name.toLowerCase().includes('мск')) 
                            ) {
                                fileName = `orac_мск.${file_format}`;

                            } else if ( (file_name.toLowerCase().includes('orac') || 
                                            file_name.toLowerCase().includes('орак')) &&
                                        (file_name.toLowerCase().includes('spb') || 
                                            file_name.toLowerCase().includes('спб')) 
                            ) {
                                fileName = `orac_спб.${file_format}`;

                            } else if ( (file_name.toLowerCase().includes('decor') || 
                                            file_name.toLowerCase().includes('декор')) &&
                                        (file_name.toLowerCase().includes('delux') || 
                                            file_name.toLowerCase().includes('делюкс')) 
                            ) {
                                fileName = `остатки_декор_делюкс.${file_format}`;

                            } else if ( (file_name.toLowerCase().includes('декор') || 
                                            file_name.toLowerCase().includes('decor')) &&
                                        (file_name.toLowerCase().includes('рус') || 
                                            file_name.toLowerCase().includes('rus')) 
                            ) {
                                fileName = `остатки_декор_рус.${file_format}`;

                            } else if (file_name.toLowerCase().includes( 'баутекс' ) || 
                                        file_name.toLowerCase().includes( 'bautex' ) 
                            ) {
                                fileName = `остатки_баутекс.${file_format}`;

                            } else if (file_name.toLowerCase().includes( 'лоймина' ) || 
                                        file_name.toLowerCase().includes( 'loymina' ) 
                            ) {
                                fileName = `остатки_лоймина.${file_format}`;

                            } else if (file_name.toLowerCase().includes( 'brink' ) || 
                                        file_name.toLowerCase().includes( 'campman' ) 
                            ) {
                                fileName = `остатки_brink&campman.${file_format}`;

                            } else if (file_name.toLowerCase().includes( 'sirpi' ) || 
                                        file_name.toLowerCase().includes( 'сирпи' ) 
                            ) {
                                fileName = `остатки_сирпи.${file_format}`;

                            }

                            await bot.getFile(msg.document.file_id).then((file) => {

                                const fileStream = bot.getFileStream(file.file_id);
                                fileStream.pipe(fs.createWriteStream(`/root/zak/xl/${fileName}`));

                                fileStream.on('end', () => {
                                    bot.sendMessage(
                                        chatId, 
                                        `Файл <b>${fileName}</b>\nуспешно сохранен.`, 
                                        { parse_mode: 'HTML' }
                                    );
                                });
                            });
                            return;

                    } else {
                        return bot.sendMessage(
                            chatId, 
                            `В целях экономии памяти, я сохраняю лишь определённые эксель файлы\nЕсли желаете, чтобы я научился работать с вашим документом, то обратитесь к моему разработчику\nn_kharitonov@manders.ru`
                        );
                    }

                } else if (user.email === '/passwordcheck') {

                    return chekPassword(chatId, msg);

                } else if (text === '/mainmenu') {

                    // lc = null;
                    await user.update({lastCommand: text}, {
                        where: {
                            chatId: chatId
                        }
                    })

                    return bot.sendMessage(
                        chatId, 
                        `Вы в главном меню, ${user.nickname}\nВаш персональный id: <code>${chatId}</code>`,
                        mainMenuOptions
                    ); 

                } else if (user.lastCommand === '/editEmail') {

                    await user.update({email: text.toLowerCase(), lastCommand: null});
                    return bot.sendMessage(
                        chatId, 
                        `Ваш email "<b>${user.email}</b>" успешно сохранён.`, 
                        mainMenuReturnOptions
                    );

                } else if (user.lastCommand === '/editNickname') {

                    await user.update({nickname: text, lastCommand: null});
                    return bot.sendMessage(
                        chatId, 
                        `Теперь я буду называть вас "<b>${user.nickname}</b>".`, 
                        mainMenuReturnOptions
                    );

                } else if (user.lastCommand === '/enterBrand') {

                    await user.update({brand: text.toUpperCase()});

                    let cValue = text;
                    let PricelistLink = await findPricelistLink(chatId, cValue);

                    if (text.length < 4) {

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId,
                            `Наименование искомого бренда не может быть короче 4х символов\nвведите бренд заново:`
                            );

                        } else {

                            if (PricelistLink.vendor === null) {
                                return bot.sendMessage(
                                    chatId, 
                                    `Такой бренд не найден, проверьте написание бренда.`
                                );
                            } else if (user.brand === 'RASCH') {
                                return bot.sendMessage(
                                    chatId,
                                    `Возможность продажи бренда Rasch нужно уточнить у Юлии Скрибник!`
                                )
                            } else {
                                await bot.sendMessage(
                                    chatId,
                                    `<b>Бренд найден</b>\nВАЖНО: <u>Уточняйте наличие каталога.\nБез каталога в наличии, продажа запрещена! Возможность продажи уточнить у Юлии Скрибник!</u>\n\n${PricelistLink.messagePrice}`,
                                    { parse_mode: 'HTML' }
                                )
                                return startCheckVendor(chatId, msg);
                            }
                        }

                } else if (user.lastCommand === '/enterVC') {

                    if (isNaN(user.vendorCode)) {
                        await user.update({vendorCode: text.toUpperCase()});
                    } else {
                        await user.update({vendorCode: text});
                    }
                    await bot.sendMessage(chatId, 'Идёт обработка вашего запроса . . .');
                    const formatedUserVendor = user.vendor.replace(/[\s-]/g, '');
                    botMsgIdx = msg.message_id += 1; 

                    if (formatedUserVendor === 'ОПУС') {

                        if (user.vendorCode.length < 4) {

                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );
                        } else {
                            return startFindOpus(chatId);
                        }

                    } else if (formatedUserVendor === 'ДЕКОРТРЕЙД') {

                        if (user.vendorCode.length < 4) {

                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );
                        } else {
                            return startFindDecaro(chatId, msg);
                        }

                    } else if (formatedUserVendor === 'ЛЕВАНТИН') {

                        if (user.vendorCode.length < 4) {

                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );
                        } else {
                            return startFindLevantin(chatId);
                        }

                    } else if (formatedUserVendor.includes('ДЕКОРДЕЛЮКС')) {

                        if (user.vendorCode.length < 4) {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );
                        } else {
                            return findDecorDelux(chatId);
                        }

                    } else if (formatedUserVendor.includes('ДЕКОРРУС')) {

                        if (user.vendorCode.length < 4) {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );
                        } else {
                            return findDecorRus(chatId);
                        }

                    } else if (formatedUserVendor.includes('БАУТЕКС')) {

                        if (user.vendorCode.length < 4) {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );
                        } else {
                            return findBautex(chatId);
                        }

                    } else if (formatedUserVendor.includes('ЛОЙМИНА')) {

                        if (user.vendorCode.length < 4) {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );
                        } else {
                            return findLoymina(chatId);
                        }

                    } else if (formatedUserVendor.includes('ОРАК')) {

                        // lc === '/oracCheck';
                        const user = await UserModel.findOne({
                            where: {
                                chatId: chatId
                            },
                            attributes: ['id', 'chatId', 'lastCommand']
                        });
                    
                        await user.update({lastCommand: '/oracCheck'}, {
                            where: {
                                chatId: chatId
                            }
                        })
                        return findOrac(chatId);

                    } else if (formatedUserVendor.includes('СИРПИ')) {

                        if (user.vendorCode.length < 4) {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );

                        } else {
                            return findSirpi(chatId);
                        }
                    }

                    if (formatedUserVendor.includes('BRINK&CAMPMAN')) {

                        if (user.vendorCode.length < 4) {
                            if (botMsgIdx !== null) {
                                bot.deleteMessage(chatId, botMsgIdx);
                                botMsgIdx = null;
                            }
                            return bot.sendMessage(
                                chatId,
                                `Наименование искомого объекта не может быть короче 4х символов\nвведите артикул заново:`
                            );

                        } else {
                            return findBrink(chatId);
                        }

                    } else {

                        // lc = '/enterNumberofVC';
                        await user.update({lastCommand: '/enterNumberofVC'}, {
                            where: {
                                chatId: chatId
                            }
                        })

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                        return bot.sendMessage(
                            chatId,
                            `Хорошо!\n<b>Запрашиваемые вами параметры:</b>\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nТеперь введите колличество:\n<i>а так же введите единицы измерения через пробел</i>`,
                            { parse_mode: 'HTML' }
                        );
                    }

                } else if (user.lastCommand === '/request1C') {

                    await user.update({vendorCode: text});
                    await bot.sendMessage(chatId, 'Идёт обработка вашего запроса . . .');
                    const vendorCode = user.vendorCode;
                    botMsgIdx = msg.message_id += 1; 
                    let findResult1C = await startRequest1C(chatId, vendorCode); 

                    if (findResult1C) {
                    
                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }

                        return bot.sendMessage(
                            chatId, 
                            `${findResult1C.messageResult1C}`,
                            { parse_mode: 'HTML' }
                        );

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

                } else if (user.lastCommand === '/enterReserveNumber') {
                    let counter = 0;
                    while (text.includes("  ") && counter < 3) {
                        text = text.replace(/\s\s/g, ' ');
                        counter++;
                    }
                    await user.update({reserveNumber: text});

                    if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {
                        return bot.sendMessage(
                            chatId, 
                            `Вы желаете зарезервировать партию <b>${user.reserveNumber.split(" ")[0]}</b> в колличестве <b>${user.reserveNumber.split(" ")[1]}</b> ед.изм?\n\n<i>если данные введены корректно, нажмите "<b>Cохранить и продолжить</b>"\nдля перезаписи введите информацию повторно</i>`, 
                            enterReserveNumberOptions
                        );
                    } else {
                        return bot.sendMessage(
                            chatId, 
                            `Вы желаете зарезервировать  <b>${user.vendorCode}</b> в колличестве <b>${user.reserveNumber}</b> ед.изм?\n\n<i>если данные введены корректно, нажмите "<b>Cохранить и продолжить</b>"\nдля перезаписи введите информацию повторно</i>`, 
                            enterReserveNumberOptions
                        );
                    }

                } else if (user.lastCommand === '/enterNumberofVC') {

                    // lc = null;
                    await user.update({lastCommand: null}, {
                        where: {
                            chatId: chatId
                        }
                    })
                    await user.update({reserveNumber: text});
                    return bot.sendMessage(
                        chatId, 
                        `Отлично!\n<b>Запрашиваемые вами параметры:</b>\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nКолличество: ${user.reserveNumber}\n\nХорошо, теперь я могу запросить наличие и срок поставки.\nНужно поставить резерв?`, 
                        startFind2Options
                    );

                } else if (user.lastCommand === '/catalogСheck') {

                    await user.update({catalog: text});

                    await bot.sendMessage(chatId, 'Идёт поиск каталога . . .');
                    botMsgIdx = msg.message_id += 1; 

                    const [Textile, Wallpaper] = await Promise.all([findCatalogTextile(chatId), findCatalogWallpaper(chatId)]);

                    if (Textile === null && Wallpaper === null) {

                        if (botMsgIdx !== null) {
                            bot.deleteMessage(chatId, botMsgIdx);
                            botMsgIdx = null;
                        }
                            return bot.sendMessage(
                            chatId, 
                            `Такого каталога у нас нет\nОбратитесь к Юлии Скрибник за уточнением возможности заказа данного артикула.\nskribnik@manders.ru\n<code>+7 966 321-80-08</code>\n\n`, 
                            {parse_mode: 'HTML'}
                        );
                    }
                    return {Textile, Wallpaper};

                } else if (user.lastCommand === '/oracCheck') {

                    await user.update({vendorCode: text.toUpperCase()});
                    await bot.sendMessage(chatId, `Идёт поиск ${text} . . .`);
                    botMsgIdx = msg.message_id += 1; 
                    return findOrac(chatId);

                } else if (text === '/infowork') {

                    return bot.sendMessage(
                        chatId, 
                        `${user.nickname} вот, что вы искали:\n\nКаталог: ${user.catalog}\nБренд: ${user.brand}\nАртикул: ${user.vendorCode}\nКолличество: ${user.reserveNumber}\n\nВаш email: ${user.email}`,
                        resetInfoWorkOptions
                    );

                } else if (text === '/infogame') {

                    // lc = null;
                    await user.update({lastCommand: null}, {
                        where: {
                            chatId: chatId
                        }
                    })

                    return bot.sendMessage(
                        chatId, 
                        `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, resetOptions
                    );

                } else if (text.toLowerCase().includes('привет')) {

                    return bot.sendSticker(
                        chatId, 
                        'https://cdn.tlgrm.app/stickers/087/0cf/0870cf0d-ec03-41e5-b239-0eb164dca72e/192/1.webp'
                    );

                } else if ( (text !== '/game' && 
                                text !== '/start' && 
                                text !== '/settings' && 
                                text !== '/files' && 
                                text !== '/x' &&
                                text !== '/whoiswho' &&
                                text !== '/abilitys' &&
                                text !== '/updatelist' &&
                                !text.startsWith('/getfile'))  
                            ) {
                            
                    return bot.sendMessage(
                        chatId,
                        `Для начала работы перейдите в Главное меню: <b>/mainmenu</b>\nи нажмите кнопку <b>"Запрос: остатки+сроки+резерв"</b>.`,
                        { parse_mode: 'HTML' }
                    );
                }

            } else {

                await createNewUser(chatId, msg);

                return chekPassword(chatId, msg);
            }
        } catch (e) {
            console.log('Ошибка в слушателе сообщений.', e)
        }
    }); 

    //слушатель колбэков==========================================================================================================================================

    bot.on('callback_query', async msg => {
        const data = msg.data;
        const chatId = msg.message.chat.id;

        console.log(msg);

        //функция перезапуска игры
        const startGame = async (chatId) => {
            const randomNumber = Math.floor(Math.random() * 10)
            chats[chatId] = randomNumber;
            return bot.sendMessage(
                chatId, 
                `Отгадывай:`, 
                gameOptions
            );
        }

        const user = await UserModel.findOne({
            where: {
                chatId: chatId
            }
        });

        try {

        if (data === '/mainmenu') {

            if (user.lastCommand === '/game' || user.lastCommand === '/again' || user.lastCommand === '/reset') {
                await bot.deleteMessage(
                    chatId, 
                    msg.message.message_id
                );
            }
            // lc = null;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, 
                `Вы в главном меню, ${user.nickname}\nВаш персональный id: <code>${chatId}</code>`,
                mainMenuOptions
            ); 

        } else if (data === '/beginwork') {

            if (!user.email) {
                await editEmail(chatId);
            } else {
                await bot.sendMessage(
                    chatId, 
                    'Для начала формирования запроса по остаткам и срокам есть два пути:\n\n<b>Поиск по каталогу:</b> - для тех случаев, когда вы не знаете из какого каталога искомый вами артикул и неизвестна возможность закупки данного артикула у поставщика.\n\n<b>Поиск по бренду:</b> - для случаев, когда вы уверенны, что искомый вами артикул возможно заказать у поставщика.', 
                    workOptions
                );
            } 
            return; 

        } else if (data === '/beginwork1') {

            if (!user.email) {
                await editEmail(chatId);
            } else {
                await bot.sendMessage(
                    chatId, 
                    'Чем могу вам помочь?', 
                    work1Options
                );
            } 
            return; 

        } else if (data === '/editNickname') {

            return editNickname(chatId);

        } else if (data === '/editEmail') {

            return editEmail(chatId);

        } else if (data === '/resetInfoWork') {
            await user.update({
                catalog: null, 
                brand: null, 
                vendorCode: null, 
                reserveNumber: null
            }, {
                where: {
                    chatId: chatId,
                }
            })

            return bot.sendMessage(
                chatId,
                `Искомые параметры сброшенны.`
            );

        } else if (data === '/checkVendor') {

            return startCheckVendor(chatId, msg);

        } else if (data === '/enterBrand') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, `Для начала работы введите бренд, по которому мы будем производить поиск:`, 
                { parse_mode: 'HTML' }
            );

        } else if (data === '/enterReserveNumber') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, `Введите номер партии и колличество, которое желаете зарезервировать:<i>например: <b>268А 3</b>\nесли партия отсутствует, то введите только колличество</i>`,
                { parse_mode: "HTML" }
            );

        } else if (data === '/preSendEmail') {

            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            if ((user.reserveNumber) !== (user.reserveNumber.split(" ")[0])) {

                const subject = `Резерв ${user.vendorCode}, партия: ${user.reserveNumber.split(" ")[0]}, ${user.reserveNumber.split(" ")[1]} ед.изм, по запросу ${chatId}`;
                const textMail = `\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, партия: ${user.reserveNumber.split(" ")[0]} в колличестве: ${user.reserveNumber.split(" ")[1]} ед.изм\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;
            
                await user.update({subject: subject, textMail: textMail}, {
                    where: {
                        chatId: chatId
                    }
                })

            } else {

                const subject = `Резерв ${user.vendorCode}, ${user.reserveNumber} ед.изм, по запросу ${chatId}`;
                const textMail = `\nЗдравствуйте!\nПросьба поставить в резерв следующую позицию:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber} ед.изм\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;

                await user.update({subject: subject, textMail: textMail}, {
                    where: {
                        chatId: chatId
                    }
                })
            }

            return bot.sendMessage(
                chatId, 
                `Сформирован email:\nТема сообщения: <strong>${user.subject}</strong>\nКому: <b>поставщику ${user.brand}</b>\nКопия: <b>purchasing_internal@manders.ru</b>\nТекст сообщения:\n${user.textMail}\n`, 
                sendReserveOptions
            );

        } else if (data === '/preSendEmailReserveYes') {

            const subject = `Наличие+сроки+резерв ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
            const textMail = `\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber}.\nПросьба поставить в резерв.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;

            await user.update({subject: subject, textMail: textMail}, {
                where: {
                    chatId: chatId
                }
            })
        
            const user = await UserModel.findOne({
                where: {
                    chatId: chatId
                },
                attributes: ['id', 'chatId', 'brand', 'subject', 'textMail']
            });

            return bot.sendMessage(
                chatId, 
                `Сформирован email:\nТема сообщения: <strong>${user.subject}</strong>\nКому: <b>поставщику ${user.brand}</b>\nКопия: <b>purchasing_internal@manders.ru</b>\nТекст сообщения:\n${user.textMail}\n`,
                sendReserveOptions
            );

        } else if (data === '/preSendEmailReserveNo') {

            const subject = `Наличие+сроки ${user.vendorCode},  ${user.reserveNumber}, по запросу ${chatId}`;
            const textMail = `\nЗдравствуйте!\nУточните, пожалуйста, наличие и срок поставки:\nартикул: ${user.vendorCode}, бренд: ${user.brand}, в колличестве: ${user.reserveNumber}.\nПожалуйста пришлите обратную связь ответным письмом на purchasing_internal@manders.ru.`;

            await user.update({subject: subject, textMail: textMail}, {
                where: {
                    chatId: chatId
                }
            })
        
            const user = await UserModel.findOne({
                where: {
                    chatId: chatId
                },
                attributes: ['id', 'chatId', 'brand', 'subject', 'textMail']
            });

            return bot.sendMessage(
                chatId, 
                `Сформирован email:\nТема сообщения: <strong>${user.subject}</strong>\nКому: <b>поставщику ${user.brand}</b>\nКопия: <b>purchasing_internal@manders.ru</b>\nТекст сообщения:\n${user.textMail}\n`, 
                sendReserveOptions
            );

        } else if (data === '/sendReserveEmail') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            return sendReserveEmail(chatId);

        } else if (data === '/catalogСheck') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, 
                'Введите <b>наименование каталога</b> содержащего искомый вами товар:\n<i>(после получения результата, вы можете отправить новое наименование для поиска следующего каталога)</i>', 
                { parse_mode: 'HTML' }
            );

        } else if (data === '/oracCheck') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, 
                'Введите искомый вами <b>артикул</b> товара ORAC :\n<i>(после получения результата, вы можете отправить другой артикул для поиска)</i>', 
                { parse_mode: 'HTML' }
            );

        } else if (data === '/request1C') {
            // lc = '/request1C';
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, 
                'Введите искомый вами <b>артикул</b>:\n<i>(после получения результата, вы можете отправить другой артикул для поиска)</i>', 
                { parse_mode: 'HTML' }
            );

        } else if (data === '/work2') {
            // lc = null;
            await user.update({lastCommand: null}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, 
                sorry, 
                mainMenuReturnOptions
            );

        } else if (data === '/work3') {
            // lc = null;
            await user.update({lastCommand: null}, {
                where: {
                    chatId: chatId
                }
            })

            return bot.sendMessage(
                chatId, 
                sorry, 
                mainMenuReturnOptions
            );

        } else if (data === '/again') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            await bot.deleteMessage(
                chatId, 
                msg.message.message_id
            );
            return startGame(chatId);

        } else if (data === '/infogame') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            await bot.deleteMessage(
                chatId, 
                msg.message.message_id
            );
            return bot.sendMessage(
                chatId, 
                `Правильных ответов: "${user.right}"\nНеправильных ответов: "${user.wrong}"`, 
                resetOptions
            ); 

        } else if(data === '/reset') {
            // lc = data;
            await user.update({lastCommand: data}, {
                where: {
                    chatId: chatId
                }
            })

            await bot.deleteMessage(
                chatId, 
                msg.message.message_id
            );
            if (user) {
                await user.update ({
                    right: 0,
                    wrong: 0,
                });
            }

            return bot.sendMessage(
                chatId, 
                `Результаты игры сброшенны:\nправильных ${user.right},\nнеправильных ${user.wrong}`, 
                againOptions
            );

        } else if (user.lastCommand === '/game' || user.lastCommand === '/again') {

            if (data == chats[chatId]) {
                user.right += 1;
                await user.save(chatId);
                await bot.deleteMessage(
                    chatId, 
                    msg.message.message_id
                );
                return bot.sendMessage(
                    chatId, 
                    `Ты отгадал цифру "${chats[chatId]}"`, 
                    againOptions
                );
            } else {
                user.wrong += 1;
                await user.save();
                await bot.deleteMessage(
                    chatId, 
                    msg.message.message_id
                );
                return bot.sendMessage(
                    chatId, 
                    `Нет, я загадал цифру "${chats[chatId]}"`, 
                    againOptions
                );  
            }
        }

        } catch (err) {    
            console.log(err);  
            return bot.sendMessage(
                chatId, 
                'Ошибка в исполнении кода прослушивателя колбэков',
            );
        }

    });

}

start();