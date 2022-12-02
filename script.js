
var balance = parseFloat($('#saldo').text());
var saldoEquity = 0;
var totalMarginEquity = 0;
var tradeActive = [];
var tradeHistory = {};
var countRequest = 0;
var buyPrice = 0;
var sellPrice = 0;
var buySpread = 0;
var sellSpread = 0.2;

var totalMarginEquityEL = $('#total-margin-equity');
var leverageEL = $('#trade-leverage');
var tradeVolEL = $('#trade-vol');
var buyActionBTN = $('#buy-action');
var sellActionBTN = $('#sell-action');
var markPriceEL = $('#markPrice');
var tradeTotalEL = $('#trade-total')

var tradeActiveContainer = $('#TRADE-ACTIVE .trade-container')

// Create WebSocket connection.
function connect() {
    const socket = new WebSocket('wss://fstream.binance.com/ws/bnbusdt@markPrice');
    // Connection opened
    socket.addEventListener('open', (event) => {
        // socket.send('Hello Server!');
    });

    // Listen for messages
    socket.addEventListener('message', (event) => {
        let data = JSON.parse(event.data);

        let markPrice = parseFloat(data.p).toFixed(2);

        document.querySelector('#markPrice').innerHTML = markPrice ?? 0;

        let markActiveTrade = [];

        let sumPNL = 0;

        for (let activeTrade of tradeActive) {

            if (activeTrade.type == 'buy') {
                activeTrade.change = markPrice - activeTrade.entryPrice;
                activeTrade.changePercent = activeTrade.change / activeTrade.entryPrice
            } else {
                activeTrade.change = activeTrade.entryPrice - markPrice;
                activeTrade.changePercent = activeTrade.change / activeTrade.entryPrice
            }

            activeTrade.pnlPercent = activeTrade.changePercent;
            activeTrade.pnl = activeTrade.totalEntryPrice * activeTrade.pnlPercent


            sumPNL += activeTrade.pnl;

            markActiveTrade.push(activeTrade);
        }

        $('#balance-equity').text((balance + sumPNL).toFixed(2))

        activeTrade = markActiveTrade;

        renderTradeActive();

        if (tradeVolEL.val() != 0) {
            calculateMarginEquity();

            calculateTradeTotal();
        }

        countRequest++;

        console.log(countRequest)

        if (countRequest == 199) {
            socket.close();
            countRequest = 0;
            connect();
        }

    });
}

$(function () {
    // connect();
    let initialMarkPrice = 50;
    buyPrice = initialMarkPrice + buySpread;
    sellPrice = initialMarkPrice - sellSpread;

    $('#markPrice').text(50);
    $('#buyPrice').text(initialMarkPrice + buySpread);
    $('#sellPrice').text(initialMarkPrice - sellSpread);

    $('#markPrice').on('click', function () {
        $('#markPriceInput').show();
        $(this).hide();
    });

    $('#markPriceInput').on('change', function () {
        $('#markPrice').show();
        $(this).hide();

        let value = $(this).val();

        if (value == '') {
            value = $('#markPrice').text();
        }

        $('#markPrice').text();

        onMarkPriceChange(parseFloat($(this).val()))
    })
})


function onMarkPriceChange(markPrice) {

    document.querySelector('#markPrice').innerHTML = markPrice ?? 0;


    buyPrice  = parseFloat(markPrice) + buySpread;
    sellPrice = parseFloat(markPrice) - sellSpread;

    $('#buyPrice').text(buyPrice);
    $('#sellPrice').text(sellPrice);

    let markActiveTrade = [];

    let sumPNL = 0;

    // calculation average and PNL
    for (let _activeTrade of tradeActive) {

        if (_activeTrade.type == 'buy') {
            _activeTrade.change = markPrice - _activeTrade.entryPrice;
            _activeTrade.changePercent = _activeTrade.change / _activeTrade.entryPrice
        } else {
            _activeTrade.change = _activeTrade.entryPrice - markPrice;
            _activeTrade.changePercent = _activeTrade.change / _activeTrade.entryPrice
        }

        _activeTrade.pnlPercent = _activeTrade.changePercent;
        _activeTrade.pnl = _activeTrade.totalEntryPrice * _activeTrade.pnlPercent

        sumPNL += _activeTrade.pnl;

        markActiveTrade.push(_activeTrade);
    }

    $('#balance-equity').text((balance + sumPNL).toFixed(2))
    console.log('balance ',(balance + sumPNL));
    if((balance + sumPNL) <= 0) {
        tradeActive = [];
        alert("Saldo tidak cukup, auto liquid");
    } else {
        tradeActive = markActiveTrade;
    }

    renderTradeActive();

    if (tradeVolEL.val() != 0) {
        calculateMarginEquity();

        calculateTradeTotal();
    }

}


function calculateMarginEquity() {
    var _saldoDeposit = parseFloat($('#saldo').text());
    var _leverage = parseInt($('#trade-leverage').val());
    var _marginEquity = (_saldoDeposit * _leverage)- (tradeActive.map(x => x.totalEntryPrice).reduce((a, b) => a+b, 0));

    totalMarginEquity = _marginEquity;

    $('#total-margin-equity').text(totalMarginEquity.toLocaleString())

    console.log(_marginEquity, totalMarginEquity);
}

function calculateTradeTotal() {
    var markPrice = parseFloat(markPriceEL.text());
    var totalTrade = markPrice * parseInt(tradeVolEL.val());
    var totalMargin = parseFloat(totalMarginEquityEL.text().replace(/,/g, ''))

    // alert(totalTrade + " | " + totalMargin)

    if (totalTrade > totalMargin) {
        tradeVolEL.val(0).change();
        let maksimal = Math.floor(totalMargin / markPrice);

        alert('Maksimal Size : ' + maksimal);
    } else {

        let freeMarginEquity = totalMarginEquity - totalTrade;

        $('#free-margin-equity').text(freeMarginEquity.toLocaleString())

        $('#trade-total').val(totalTrade.toFixed(2));
    }

}

function tradeActionBuySell(__type) {

    if (
        leverageEL.val() == ''
        || (parseFloat(tradeVolEL.text()) == NaN && parseFloat(tradeVolEL.text()) <= 0)
        || parseFloat(markPriceEL.text()) == NaN
    ) {
        alert("Pastikan input sudah terisi.");

        return false;
    }

    let markPrice = __type == 'buy' ? buyPrice:sellPrice;
    let balance = parseFloat($('#balance-equity').text())/parseInt(tradeVolEL.val());

    let tradeData = {
        type: __type,
        leverage: leverageEL.val(),
        volume: tradeVolEL.val(),
        entryPrice: markPrice,
        totalEntryPrice: parseFloat(markPrice) * parseInt(tradeVolEL.val()),
        change: 0,
        changePercent: 0,
        pnl: 0,
        pnlPercent: 0,

        entryPriceAcc: parseFloat(markPrice),
        entryPriceAccCount: 0,

        liqPrice: (parseFloat(markPrice) - balance),
    }

    // console.log('BEFORE', tradeHistory, tradeData);

    if (tradeHistory[__type] == undefined) {
        tradeHistory[__type] = [tradeData.entryPrice];
    } else {
        tradeHistory[__type].push(tradeData.entryPrice);
    }

    let activeFiltered = tradeActive.filter(x => x.type == __type);

    /* if unique transaction has found (type) */
    if (activeFiltered.length > 0) {

        let averageEntryPrice = tradeHistory[__type].reduce((acc, curr) => {
            return parseFloat(acc) + parseFloat(curr)
        }, 0) / tradeHistory[__type].length

        let activeFilteredTradeData = activeFiltered[0];

        activeFilteredTradeData.entryPrice = averageEntryPrice.toFixed(2)
        activeFilteredTradeData.volume = parseInt(activeFilteredTradeData.volume) + parseInt(tradeData.volume);
        activeFilteredTradeData.totalEntryPrice = activeFilteredTradeData.entryPrice * activeFilteredTradeData.volume;

        activeFilteredTradeData.leverage = leverageEL.val()

        tradeActive.forEach((item, index) => {
            if (item.type == __type) {
                tradeActive.splice(index, 1)
            }
        })

        tradeActive.push(activeFilteredTradeData)

    } else {
        tradeActive.push(tradeData)
    }


    renderTradeActive();

    calculateMarginEquity();

    leverageEL.val('')
    tradeVolEL.val(0)
    tradeTotalEL.val(0)


    $('#markPriceInput').trigger('change')
}

leverageEL.on('change', function () {
    calculateMarginEquity();

    let leverage = $(this).val()
    let markPrice = parseFloat(markPriceEL.text());
    let tradeMarginEquity = parseFloat(markPrice * leverage).toFixed(2);

});

tradeVolEL.on('keyup', function () {
    calculateMarginEquity();

    calculateTradeTotal();
});


tradeVolEL.on('change', function () {
    calculateMarginEquity();
    calculateTradeTotal();
});


buyActionBTN.on('click', function () {
    tradeActionBuySell('buy')
})

sellActionBTN.on('click', function () {

    tradeActionBuySell('sell')

})

function renderTradeActive() {
    tradeActiveContainer.html('');

    for (let trade of tradeActive) {

        let change = trade.change;
        let changeHTML = ''
        let changePercentHTML = ''

        if (change > 0) {
            changeHTML = `<span class="font-bold text-xl text-green-400 block">+${change.toFixed(3)}</span>`
            changePercentHTML = `<span class="text-lg text-green-400">+${(trade.changePercent * 100).toFixed(2)}%</span>`
        } else if (change < 0) {
            changeHTML = `<span class="font-bold text-xl text-red-400 block">${change.toFixed(3)}</span>`
            changePercentHTML = `<span class="text-lg text-red-400">${(trade.changePercent * 100).toFixed(2)}%</span>`
        } else {
            changeHTML = `<span class="font-bold text-xl text-gray-400 block">${change.toFixed(0)}</span>`
            changePercentHTML = `<span class="text-lg text-gray-400">0%</span>`

        }

        let type = `<span class="rounded bg-green-500 text-base py-1 px-3">BUY</span>`;

        if (trade.type != 'buy') {
            type = `<span class="rounded bg-red-500 text-base py-1 px-3">SELL</span>`;
        }

        tradeActiveContainer.append(`
                    <div class="trade-active-item border border-gray-700 rounded p-3 mb-2">
                        <div class="grid grid-cols-3">
                            <div class="flex flex-col justify-between gap-5 col-span-2">
                                <h3 class="text-white font-bold">BNB/USDT ${type}</h3>

                                <div class="flex gap-3 text-xs">
                                    <h5>Vol: <span class="volume block text-base">${trade.volume}</span></h5>
                                    <h5>Leverage: <span class="leverage block text-base">${trade.leverage}</span></h5>
                                    <h5>PNL: <span class="entryPrice block text-base">${trade.pnl.toFixed(2)}</span></h5>
                                </div>
                                <div class="flex gap-3 text-xs">
                                    <h5>Entry Price: <span class="entryPrice block text-base">${parseFloat(trade.entryPrice).toFixed(2)}</span></h5>
                                    <h5>Total Entry: <span class="entryPrice block text-base">$${parseFloat(trade.totalEntryPrice).toFixed(2)}</span></h5>
                                    <h5>Liq. Price: <span class="volume block text-base">${trade.liqPrice}</span></h5>
                                </div>

                            </div>

                            <div class="text-right flex flex-col justify-center">
                                ${changeHTML}
                                ${changePercentHTML}
                            </div>
                        </div>

                    </div>
                `)
    }
}


