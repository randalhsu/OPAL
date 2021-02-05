const TICKER_PRICE_FORMAT = {
    MES: {
        precision: 2,
        minMove: 0.25,
    },
};

const chartWidth = Math.floor(document.body.clientWidth * 0.9 / 2);
//TODO: resize-able

let chartAttributes = {
    width: chartWidth,
    height: 500,
    priceScale: {
        position: 'left',
        scaleMargins: {
            top: 0.05,
            bottom: 0.05,
        },
    },
    localization: {
        dateFormat: 'yyyy/MM/dd',
    },
    layout: {
        backgroundColor: '#000000',
        textColor: 'rgba(255, 255, 255, 0.9)',
    },
    grid: {
        vertLines: {
            visible: false,
        },
        horzLines: {
            visible: false,
        },
    },
    crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
    },
    timeScale: {
        borderColor: 'rgba(197, 203, 206, 0.8)',
        timeVisible: true,
        secondsVisible: false,
    },
};

const chart1 = LightweightCharts.createChart(document.getElementById('chart1'), chartAttributes);
chartAttributes.priceScale.position = 'right';
const chart2 = LightweightCharts.createChart(document.getElementById('chart2'), chartAttributes);
//TODO: clear all crosshair when mouse left chart
let mouseOverChart1 = false;
let mouseOverChart2 = false;

function crosshair1SyncHandler(e) {
    if (e.time !== undefined) {
        mouseOverChart1 = true;
        let xx = chart2.timeScale().timeToCoordinate(e.time);
        if (xx === null) {
            xx = chart2.timeScale().timeToCoordinate(e.time - (e.time % 3600));
        }
        const price = chart1.getCrossHairPrice();
        const yy = candleSeries2.priceToCoordinate(price);
        chart2.setCrossHairXY(xx, yy, true);
    } else if (e.point !== undefined) {
        mouseOverChart1 = true;
        const price = chart1.getCrossHairPrice();
        const yy = candleSeries2.priceToCoordinate(price);
        chart2.setCrossHairXY(0, yy, true);
    } else if (mouseOverChart2) {
        mouseOverChart2 = false;
        chart2.clearCrossHair();
    }
}
function crosshair2SyncHandler(e) {
    if (e.time !== undefined) {
        mouseOverChart2 = true;
        let xx = chart1.timeScale().timeToCoordinate(e.time);
        if (xx === null) {
            xx = chart1.timeScale().timeToCoordinate(e.time - (e.time % 3600));
        }
        const price = chart2.getCrossHairPrice();
        const yy = candleSeries1.priceToCoordinate(price);
        chart1.setCrossHairXY(xx, yy, true);
    } else if (e.point !== undefined) {
        mouseOverChart2 = true;
        const price = chart2.getCrossHairPrice();
        const yy = candleSeries1.priceToCoordinate(price);
        chart1.setCrossHairXY(e.point.x, yy, true);
    } else if (mouseOverChart1) {
        mouseOverChart1 = false;
        chart1.clearCrossHair();
    }
}

chart1.subscribeCrosshairMove(crosshair1SyncHandler);
chart2.subscribeCrosshairMove(crosshair2SyncHandler);


const candleAttributes = {
    priceLineVisible: false,
    upColor: 'rgba(255, 255, 255, 1)',
    downColor: 'rgba(37, 41, 48, 1)',
    borderDownColor: 'rgba(126, 131, 140, 1)',
    borderUpColor: 'rgba(126, 131, 140, 1)',
    wickDownColor: 'rgba(126, 131, 140, 1)',
    wickUpColor: 'rgba(126, 131, 140, 1)',
};

const candleSeries1 = chart1.addCandlestickSeries(candleAttributes);
const candleSeries2 = chart2.addCandlestickSeries(candleAttributes);


function resampleToHourlyBars(data) {
    let result = [];
    const allHours = [...new Set(data.map(bar => Math.floor(bar.time / 3600)))];
    allHours.forEach(hour => {
        const filteredData = data.filter(e => Math.floor(e.time / 3600) === hour);
        if (filteredData.length > 0) {
            let bar = {};
            bar.time = hour * 3600;
            bar.open = filteredData[0].open;
            bar.close = filteredData[filteredData.length - 1].close;
            bar.high = d3.max(filteredData, e => e.high);
            bar.low = d3.min(filteredData, e => e.low);
            result.push(bar);
        }
    });
    return result;
}

let fetchedData = [];

function getCurrentChartTime() {
    if (fetchedData.length > 0) {
        return fetchedData[fetchedData.length - 1].time;
    }
    return null;
}

//TODO: fit to a chart
function updateSeriesScale(series1, series2) {
    const barsInfo = series2.barsInLogicalRange(chart2.timeScale().getVisibleLogicalRange());
    const filteredData = fetchedData.filter(e => barsInfo.from <= e.time && e.time <= barsInfo.to);

    const minPrice = d3.min(filteredData, e => e.low);
    const maxPrice = d3.max(filteredData, e => e.high);
    const attributes = {
        autoscaleInfoProvider: () => ({
            priceRange: {
                minValue: minPrice,
                maxValue: maxPrice,
            },
            margins: {
                above: 10,
                below: 10,
            },
        }),
    };
    series1.applyOptions(attributes);
    series2.applyOptions(attributes);
}

function drawDailyOpenPrice(series1, series2) {
    if (fetchedData.length === 0) {
        return;
    }
    const localeHourDiff = new Date().getTimezoneOffset() / 60;
    for (let i = fetchedData.length - 1; i >= 0; --i) {
        const date = new Date(fetchedData[i].time * 1000);
        if ((date.getHours() + localeHourDiff + 24) % 24 === 18 && date.getMinutes() === 0) {
            const dailyOpenPrice = fetchedData[i].open;
            attachPriceLineToSeries(series1, dailyOpenPrice);
            attachPriceLineToSeries(series2, dailyOpenPrice);
            return;
        }
    }
}

function attachPriceLineToSeries(series, price) {
    if (series.priceLine !== undefined) {
        if (price === series.priceLine.price) {
            return;
        }
        series.removePriceLine(series.priceLine);
    }
    let priceLine = series.createPriceLine({
        price: price,
        color: 'rgba(207, 166, 0, 1)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
    });
    priceLine.price = price;
    series.priceLine = priceLine;
}

function registerChangeTickerHandler() {
    const buttons = document.getElementById('ticker-selector').querySelectorAll('button');
    for (const button of buttons) {
        button.onclick = () => {
            const ticker = button.innerText;
            const currentTickerNode = document.getElementById('current-ticker');
            const currentTicker = currentTickerNode.innerText;
            if (ticker !== currentTicker) {
                fetchedData = [];
                sendSwitchAction(ticker);
                currentTickerNode.innerText = ticker;
            }
        }
    }
}

function registerCopyDatetimeHandler() {
    const button = document.getElementById('copy-datetime-button');
    button.onclick = () => {
        const string = $('#datetimepicker1').datetimepicker('date').format('YYYY/MM/DD HH:mm');
        copyTextToClipboard(string);
    }
}

function copyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    let message = 'Failed to copy!';
    try {
        if (document.execCommand('copy')) {
            message = 'Copied datetime!';
        }
    } catch (error) {
        console.log(error);
    }
    const el = document.getElementById('message');
    el.innerText = message;
    setTimeout(() => el.innerText = '', 1000);
    document.body.removeChild(textArea);
}

function updateCurrentDatetimePicker(timestamp) {
    if (typeof timestamp === 'number') {
        $('#datetimepicker1').datetimepicker('date', moment.utc(timestamp * 1000));
    }
}


const socket = new WebSocket(`ws://${window.location.host}/ticker/MES`);

socket.onopen = function (e) {
    registerChangeTickerHandler();
    registerCopyDatetimeHandler();
    registerKeyboardHandler();

    sendInitAction();
}

socket.onmessage = function (e) {
    const response = JSON.parse(e.data);
    //console.log(response);
    if (response.hasOwnProperty('data')) {
        const ticker = response['ticker'];
        const data = (response['data']);
        if (data.length === 0) {
            console.log('error: empty data!')
            return
        }
        if (data.length === 1) {
            // step
            const bar = data[0];
            if (bar.time == getCurrentChartTime()) {
                console.log('Last bar!');
                return;
            }
            fetchedData.push(bar);
            const hourlyData = resampleToHourlyBars(fetchedData);
            candleSeries1.setData(hourlyData);
            candleSeries2.update(bar);
        } else {
            // init, switch, goto
            const hourlyData = resampleToHourlyBars(data);
            candleSeries1.setData(hourlyData);
            candleSeries2.setData(data);
            fetchedData = data;

            candleSeries1.applyOptions({
                priceFormat: TICKER_PRICE_FORMAT[ticker],
            });
            candleSeries2.applyOptions({
                priceFormat: TICKER_PRICE_FORMAT[ticker],
            });
        }
        updateSeriesScale(candleSeries1, candleSeries2);
        drawDailyOpenPrice(candleSeries1, candleSeries2);
        updateCurrentDatetimePicker(getCurrentChartTime());
    }
}

//TODO: on leave page
socket.onclose = function (e) {
    console.log('close bye');
}

socket.onerror = function (e) {
    console.log('error bye');
}
//console.log(socket);

function sendInitAction() {
    socket.send(JSON.stringify({ action: 'init' }));
}

function sendStepAction() {
    socket.send(JSON.stringify({ action: 'step' }));
}

function sendSwitchAction(ticker) {
    // Change ticker
    socket.send(JSON.stringify({
        action: 'switch',
        ticker: ticker,
    }));
}

function sendGotoAction(timestamp) {
    // Change time
    socket.send(JSON.stringify({
        action: 'goto',
        timestamp: timestamp,
    }));
}


function registerKeyboardHandler() {
    window.addEventListener('keydown', function (event) {
        console.log(`KeyboardEvent: code='${event.code}'`);
        if (event.code === 'Space') {
            sendStepAction();
        }
    }, true);
}

window.onload = function () {
    $('#datetimepicker1').datetimepicker({
        format: 'YYYY/MM/DD HH:mm',
        dayViewHeaderFormat: 'YYYY/MM',
        stepping: 5,
        sideBySide: true,
        useCurrent: false,
    });

    $('#datetimepicker1').on('hide.datetimepicker', ({ date }) => {
        const localeSecondDiff = new Date().getTimezoneOffset() * 60;
        const newTime = date.utc().format('X') - localeSecondDiff;
        if (newTime !== getCurrentChartTime()) {
            sendGotoAction(newTime);
        }
    })
};
