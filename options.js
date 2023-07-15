module.exports = {
    gameOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 1, callback_data: '1'},{text: 2, callback_data: '2'},{text: 3, callback_data: '3'}],
                [{text: 4, callback_data: '4'},{text: 5, callback_data: '5'},{text: 6, callback_data: '6'}],
                [{text: 7, callback_data: '7'},{text: 8, callback_data: '8'},{text: 9, callback_data: '9'}],
                [{text: 0, callback_data: '0'}],
            ]
        })
    },
    
    againOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Играть ещё раз?', callback_data: '/again'}],
                [{text: 'Показать результаты', callback_data: '/infogame'}],
            ]
        })
    },

    resetOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Сбросить результаты', callback_data: '/reset'}],
            ]
        })
    },

    mainMenuOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },

    beginWorkOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Продолжить', callback_data: '/beginwork'}],
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },

    workOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Остатки/сроки/резерв', callback_data: '/work1'}],
                [{text: 'Превью изображений', callback_data: '/work2'}],
                [{text: 'Добавить в заказ', callback_data: '/work3'}],
            ]
        })
    },

    startFindOptions: {
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Искать другой бренд', callback_data: '/beginwork'}],
                [{text: 'В главное меню', callback_data: '/mainmenu'}],
            ]
        })
    },

    VCOptions: {
        parse_mode: 'HTML',
        reply_markup: JSON.stringify( {
            inline_keyboard: [
                [{text: 'Продолжить', callback_data: '/enterVC'}],
            ]
        })
    },

}