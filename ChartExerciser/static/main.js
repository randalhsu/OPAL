'use strict';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';

let tickersInfo = {};
let fetchedBars = [];


const chartWidth = Math.floor(document.body.clientWidth * 0.95 / 2);
const chartHeight = Math.floor(chartWidth * 0.8);
//TODO: resize-able

let chartOptions = {
    width: chartWidth,
    height: chartHeight,
    priceScale: {
        position: 'left',
        scaleMargins: {
            top: 0.05,
            bottom: 0.05,
        },
    },
    localization: {
        dateFormat: 'yyyy-MM-dd',
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
        rightOffset: 2,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
        borderColor: 'rgba(197, 203, 206, 0.8)',
        timeVisible: true,
        secondsVisible: false,
    },
};

const chart1 = LightweightCharts.createChart(document.getElementById('chart1'), chartOptions);
chartOptions.priceScale.position = 'right';
const chart2 = LightweightCharts.createChart(document.getElementById('chart2'), chartOptions);

function resetChart1TimeScale() {
    const time = getCurrentChartTime();
    const coordinate = chart1.timeScale().timeToCoordinate(time - time % 3600);
    const logical = chart1.timeScale().coordinateToLogical(coordinate);
    // Show two days' data with 2-bar margin left and right
    const range = {
        from: logical - (2 * 23 + 2),
        to: logical + 2,
    };
    chart1.timeScale().setVisibleLogicalRange(range);
}

let mouseOverChart1 = false;
let mouseOverChart2 = false;
let mouseHoverPriceString = null;

function crosshair1SyncHandler(e) {
    if (e.point === undefined) {
        // triggered by mouse leave event
        if (mouseOverChart1) {
            mouseOverChart1 = false;
            chart2.clearCrossHair();
            mouseHoverPriceString = null;
        }
    } else {
        mouseOverChart1 = true;
        let xx = 0;
        if (e.time !== undefined) {
            xx = chart2.timeScale().timeToCoordinate(e.time);
            if (xx === null) {
                xx = chart2.timeScale().timeToCoordinate(e.time - (e.time % 3600));
            }
        }
        const price = candleSeries1.coordinateToPrice(e.point.y);
        const yy = candleSeries2.priceToCoordinate(price);
        chart2.setCrossHairXY(xx, yy, true);
        mouseHoverPriceString = chart1.priceScale('left').formatPrice(price);
    }
}

function crosshair2SyncHandler(e) {
    if (e.point === undefined) {
        // triggered by mouse leave event
        if (mouseOverChart2) {
            mouseOverChart2 = false;
            chart1.clearCrossHair();
            mouseHoverPriceString = null;
        }
    } else {
        mouseOverChart2 = true;
        let xx = 0;
        if (e.time !== undefined) {
            xx = chart1.timeScale().timeToCoordinate(e.time);
            if (xx === null) {
                xx = chart1.timeScale().timeToCoordinate(e.time - (e.time % 3600));
            }
        }
        const price = candleSeries2.coordinateToPrice(e.point.y);
        const yy = candleSeries1.priceToCoordinate(price);
        chart1.setCrossHairXY(xx, yy, true);
        mouseHoverPriceString = chart2.priceScale('right').formatPrice(price);
    }
}

chart1.subscribeCrosshairMove(crosshair1SyncHandler);
chart2.subscribeCrosshairMove(crosshair2SyncHandler);


const candleOptions = {
    priceLineVisible: false,
    upColor: 'rgba(255, 255, 255, 1)',
    downColor: 'rgba(37, 41, 48, 1)',
    borderDownColor: 'rgba(126, 131, 140, 1)',
    borderUpColor: 'rgba(126, 131, 140, 1)',
    wickDownColor: 'rgba(126, 131, 140, 1)',
    wickUpColor: 'rgba(126, 131, 140, 1)',
};

const candleSeries1 = chart1.addCandlestickSeries(candleOptions);
const candleSeries2 = chart2.addCandlestickSeries(candleOptions);


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

function getCurrentChartTime() {
    if (fetchedBars.length > 0) {
        return fetchedBars[fetchedBars.length - 1].time;
    }
    return null;
}


let specifiedDominantSeries = undefined;

function updateSeriesPriceScales(series1, series2, dominantSeries) {
    let series;
    if (dominantSeries === undefined) {
        series = (specifiedDominantSeries === undefined ? series1 : specifiedDominantSeries);
    } else {
        series = specifiedDominantSeries = dominantSeries;
    }
    const chart = (series === series1 ? chart1 : chart2);
    const oneBarTimeMarginInSeconds = (series === series1 ? 3600 : 300);

    const barsInfo = series.barsInLogicalRange(chart.timeScale().getVisibleLogicalRange());
    const filteredData = fetchedBars.filter(
        e => barsInfo.from <= e.time && e.time <= barsInfo.to + oneBarTimeMarginInSeconds * 1000
    );

    const minPrice = d3.min(filteredData, e => e.low);
    const maxPrice = d3.max(filteredData, e => e.high);
    const options = {
        autoscaleInfoProvider: () => ({
            priceRange: {
                minValue: minPrice,
                maxValue: maxPrice,
            },
            margins: {
                above: 5,
                below: 5,
            },
        }),
    };
    series1.applyOptions(options);
    series2.applyOptions(options);
}

function setPriceScalesAutoScale() {
    chart1.priceScale('left').applyOptions({ autoScale: true });
    chart2.priceScale('right').applyOptions({ autoScale: true });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fullUpdateSeriesPriceScales(series1, series2, dominantSeries) {
    // run updateSeriesScale() just once may not be enough, since new price range forms
    for (let i = 0; i < 3; ++i) {
        updateSeriesPriceScales(series1, series2, dominantSeries);
        await sleep(50);
    }
}

async function resetAllScales() {
    resetChart1TimeScale();
    chart2.timeScale().resetTimeScale();
    setPriceScalesAutoScale();
    specifiedDominantSeries = undefined;
    fullUpdateSeriesPriceScales(candleSeries1, candleSeries2);
}

function registerFitButtonsHandler() {
    document.getElementById('fit-chart1-button').onclick = (event) => {
        fullUpdateSeriesPriceScales(candleSeries1, candleSeries2, candleSeries1);
        setPriceScalesAutoScale();
        event.target.blur();
    }
    document.getElementById('fit-chart2-button').onclick = (event) => {
        fullUpdateSeriesPriceScales(candleSeries1, candleSeries2, candleSeries2);
        setPriceScalesAutoScale();
        event.target.blur();
    }
    document.getElementById('reset-scales-button').onclick = (event) => {
        resetAllScales();
        event.target.blur();
    }
}


function drawDailyOpenPrice(series1, series2) {
    const localeHourDiff = new Date().getTimezoneOffset() / 60;
    for (let i = fetchedBars.length - 1; i >= 0; --i) {
        const date = new Date(fetchedBars[i].time * 1000);
        //TODO: DST may change hour?
        if ((date.getHours() + localeHourDiff + 24) % 24 === 18 && date.getMinutes() === 0) {
            const dailyOpenPrice = fetchedBars[i].open;
            attachDailyOpenPriceLineToSeries(series1, dailyOpenPrice);
            attachDailyOpenPriceLineToSeries(series2, dailyOpenPrice);
            return;
        }
    }
}

function attachDailyOpenPriceLineToSeries(series, price) {
    if (series.dailyOpenPriceLine !== undefined) {
        if (price === series.dailyOpenPriceLine.options().price) {
            return;
        }
        series.removePriceLine(series.dailyOpenPriceLine);
    }
    series.dailyOpenPriceLine = series.createPriceLine({
        price: price,
        color: 'rgba(207, 166, 0, 1)',
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
    });
}

let alertPriceStrings = [];

function attachAlertPriceLinesToSeries(series) {
    if (series.alertPriceLines === undefined) {
        series.alertPriceLines = [];
    }
    const alreadyAttachedAlertPriceStrings = [...series.alertPriceLines.map(priceLine => priceLine.priceString)];
    for (const priceString of alertPriceStrings) {
        if (alreadyAttachedAlertPriceStrings.includes(priceString)) {
            continue;
        }
        const alertPriceLine = series.createPriceLine({
            price: +priceString,
            color: 'rgba(0, 86, 179, 1)',
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dotted,
        });
        alertPriceLine.priceString = priceString;
        series.alertPriceLines.push(alertPriceLine);
    }
}

function removeAllAlertPriceLinesFromSeries(series) {
    if (series.alertPriceLines === undefined) {
        return;
    }
    for (const priceLine of series.alertPriceLines) {
        series.removePriceLine(priceLine);
    }
    series.alertPriceLines = [];
}

function addAlertPriceString(priceString) {
    if (priceString === null) {
        return;
    }
    if (alertPriceStrings.includes(priceString)) {
        showMessage(`🔔 ${priceString}`, 1500);
        return;
    }
    alertPriceStrings.push(priceString);
    alertPriceStrings.sort().reverse();
    attachAlertPriceLinesToSeries(candleSeries1);
    attachAlertPriceLinesToSeries(candleSeries2);
    updateAlertPricesTable();
    showMessage(`🔔 ${priceString}`, 1500);
}

function removeAlertPriceString(priceString) {
    alertPriceStrings = alertPriceStrings.filter(s => s !== priceString);
    for (const series of [candleSeries1, candleSeries2]) {
        for (const priceLine of series.alertPriceLines) {
            if (priceLine.priceString === priceString) {
                series.removePriceLine(priceLine);
                series.alertPriceLines = series.alertPriceLines.filter(
                    priceLine => priceLine.priceString !== priceString
                );
                break;
            }
        }
    }
    updateAlertPricesTable();
}

function updateAlertPricesTable() {
    const ul = document.getElementById('alert-prices-ul');
    while (ul.firstChild) {
        ul.removeChild(ul.firstChild);
    }

    const titleLi = document.createElement('li');
    titleLi.setAttribute('class', 'list-group-item');
    titleLi.innerHTML = `
    <i class="fa fa-bell" aria-hidden="true"></i>
    &nbsp;&nbsp;Alert Prices
    <button type="button" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button>
    `;
    titleLi.getElementsByTagName('button')[0].onclick = () => {
        removeAllAlerts();
    };
    ul.appendChild(titleLi);

    if (alertPriceStrings.length === 0) {
        const li = document.createElement('li');
        li.setAttribute('class', 'list-group-item');
        li.innerHTML = '(Empty)';
        ul.appendChild(li);
    } else {
        for (const priceString of alertPriceStrings) {
            const li = document.createElement('li');
            li.setAttribute('class', 'list-group-item list-group-item-primary');
            li.innerHTML = `
            ${priceString}
            <button type="button" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            `;
            li.getElementsByTagName('button')[0].onclick = () => {
                removeAlertPriceString(priceString);
            };
            ul.appendChild(li);
        }
    }
}

function checkIfAlertTriggered() {
    let isAlertTriggered = false;
    if (fetchedBars.length >= 2) {
        const lastBar = fetchedBars[fetchedBars.length - 1];
        const secondLastBar = fetchedBars[fetchedBars.length - 2];
        let high = lastBar.high;
        let low = lastBar.low;
        // handle gap
        if (lastBar.low > secondLastBar.high) {
            low = secondLastBar.high;
        }
        if (lastBar.high < secondLastBar.low) {
            high = secondLastBar.low;
        }

        for (const priceString of alertPriceStrings) {
            const price = +priceString;
            if (low <= price && price <= high) {
                showMessage(`🔔 ${priceString} triggered!`, 2000);
                removeAlertPriceString(priceString);
                isAlertTriggered = true;
            }
        }
    }
    if (isAlertTriggered) {
        beep();
    }
    return isAlertTriggered;
}

function removeAllAlerts() {
    alertPriceStrings = [];
    removeAllAlertPriceLinesFromSeries(candleSeries1);
    removeAllAlertPriceLinesFromSeries(candleSeries2);
    updateAlertPricesTable();
}

function beep(frequency = 718, type = 'triangle', volume = 0.1, duration = 250) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = volume;
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    oscillator.start();
    setTimeout(() => oscillator.stop(), duration);
};

function showMessage(message, timeout = 0) {
    const el = document.getElementById('message');
    el.innerText = message;
    if (timeout > 0) {
        setTimeout(() => el.innerText = '', timeout);
    }
}

function registerChangeTickerHandler() {
    const buttons = document.getElementById('ticker-selector').querySelectorAll('button');
    for (const button of buttons) {
        button.onclick = () => {
            const ticker = button.innerText;
            const currentTickerNode = document.getElementById('current-ticker');
            const currentTicker = currentTickerNode.innerText;
            if (ticker !== currentTicker) {
                fetchedBars = [];
                sendSwitchAction(ticker);
                currentTickerNode.innerText = ticker;
            }
        }
    }
}

function registerCopyDatetimeHandler() {
    const button = document.getElementById('copy-datetime-button');
    button.onclick = () => {
        const string = $('#datetimepicker1').datetimepicker('date').format(DATETIME_FORMAT);
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
    showMessage(message, 1500);
    document.body.removeChild(textArea);
}

function updateDatetimepickerCurrentDatetime(timestamp) {
    //TODO: locale bug when near final bar
    if (typeof timestamp === 'number') {
        $('#datetimepicker1').datetimepicker('date', moment.utc(timestamp * 1000));
    }
}

function updateDatetimepickerRange(ticker) {
    // Reset first, otherwise may get error due to minDate > maxDate
    const veryMinDate = moment.utc(946684800000);
    const veryMaxDate = moment.utc(4102444800000);
    $('#datetimepicker1').datetimepicker('minDate', veryMinDate);
    $('#datetimepicker1').datetimepicker('maxDate', veryMaxDate);

    const localeSecondDiff = new Date().getTimezoneOffset() * 60;
    const minDate = moment.utc((tickersInfo[ticker].minDate + localeSecondDiff) * 1000);
    const maxDate = moment.utc((tickersInfo[ticker].maxDate + localeSecondDiff) * 1000);
    $('#datetimepicker1').datetimepicker('minDate', minDate);
    $('#datetimepicker1').datetimepicker('maxDate', maxDate);
}


const fastForwardStatus = {
    isFastForwarding: false,
    fastForwardedBars: 0,
    N_BARS: 24,
}

function checkIfContinueFastForwardJourney(lastBarTriggeredAlert) {
    if (lastBarTriggeredAlert) {
        fastForwardStatus.isFastForwarding = false;
        fastForwardStatus.fastForwardedBars = 0;
        return;
    }
    if (!fastForwardStatus.isFastForwarding) {
        return;
    }
    fastForwardStatus.fastForwardedBars += 1;
    if (fastForwardStatus.fastForwardedBars >= fastForwardStatus.N_BARS) {
        fastForwardStatus.isFastForwarding = false;
        fastForwardStatus.fastForwardedBars = 0;
        return;
    }
    sendStepAction();
}


const socket = new WebSocket(`ws://${window.location.host}/socket`);

socket.onopen = function (e) {
    initDatetimepicker();
    registerChangeTickerHandler();
    registerCopyDatetimeHandler();
    registerKeyboardEventHandler();
    registerChartMouseClickHandler(chart1, 'chart1');
    registerChartMouseClickHandler(chart2, 'chart2');
    registerFitButtonsHandler();
    updateAlertPricesTable();

    sendInitAction();
    sendSwitchAction('MES');
}

socket.onmessage = function (e) {
    const response = JSON.parse(e.data);
    let hourlyBars;
    //console.log(response);
    switch (response.action) {
        case 'init':
            tickersInfo = response.data;
            return;
            break;

        case 'step':
            const bar = response.data[0];
            if (bar.time == getCurrentChartTime()) {
                showMessage('Already reached final bar!', 2000);
                return;
            }
            fetchedBars.push(bar);
            hourlyBars = resampleToHourlyBars(fetchedBars);
            candleSeries1.setData(hourlyBars);
            candleSeries2.update(bar);

            const lastBarTriggeredAlert = checkIfAlertTriggered();
            checkIfContinueFastForwardJourney(lastBarTriggeredAlert);
            break;

        case 'stepback':
            // do nothing
            break;

        case 'switch':
        case 'goto':
            const bars = response.data;
            const ticker = response.ticker;
            hourlyBars = resampleToHourlyBars(bars);
            candleSeries1.setData(hourlyBars);
            candleSeries2.setData(bars);
            fetchedBars = bars;

            candleSeries1.applyOptions({
                priceFormat: tickersInfo[ticker],
            });
            candleSeries2.applyOptions({
                priceFormat: tickersInfo[ticker],
            });
            removeAllAlerts();

            if (response.action === 'switch') {
                updateDatetimepickerRange(ticker);
                resetChart1TimeScale();
            }
            break;
    }
    updateSeriesPriceScales(candleSeries1, candleSeries2);
    drawDailyOpenPrice(candleSeries1, candleSeries2);
    updateDatetimepickerCurrentDatetime(getCurrentChartTime());
}

socket.onclose = function (e) {
    console.log('close bye');
}

socket.onerror = function (e) {
    console.log('error bye');
}

function sendInitAction() {
    socket.send(JSON.stringify({ action: 'init' }));
}

function sendStepAction() {
    socket.send(JSON.stringify({ action: 'step' }));
}

function sendStepbackAction(timestamp) {
    socket.send(JSON.stringify({
        action: 'stepback',
        timestamp: timestamp,
    }));
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


function registerKeyboardEventHandler() {
    window.addEventListener('keydown', function (event) {
        console.log(`KeyboardEvent: code='${event.code}'`);
        switch (event.code) {
            case 'Space':
            case 'ArrowRight':
                const currentTicker = document.getElementById('current-ticker').innerText;
                const maxDate = tickersInfo[currentTicker].maxDate;
                if (maxDate == getCurrentChartTime()) {
                    showMessage('Already reached final bar!', 2000);
                    return;
                }
                sendStepAction();
                // Prevent scrolling page with space key
                if (event.code === 'Space' && event.target === document.body) {
                    event.preventDefault();
                }
                break;

            case 'KeyF':
                // Fast forward until triggered any alert, or at most N_BARS,
                // whichever happens first
                fastForwardStatus.isFastForwarding = true;
                sendStepAction();
                break;

            case 'ArrowLeft':
                if (fetchedBars.length <= 1) {
                    showMessage('Already reached the first bar!', 2000);
                    return;
                }
                fetchedBars.pop();
                const hourlyBars = resampleToHourlyBars(fetchedBars);
                candleSeries1.setData(hourlyBars);
                candleSeries2.setData(fetchedBars);
                sendStepbackAction(getCurrentChartTime());
                break;

            case 'KeyA':
                addAlertPriceString(mouseHoverPriceString);
                break;
        }
    }, true);
}

function setChartMenuVisibility(visibility) {
    const menu = document.getElementById('chart-menu');
    const classList = menu.classList;
    if (visibility === true) {
        classList.remove('d-none');
    } else if (visibility === false) {
        classList.add('d-none');
    }
}

function registerChartMouseClickHandler(chart, chartElementId) {
    const menu = document.getElementById('chart-menu');
    const container = document.getElementById(chartElementId);
    const leftPriceScale = container.getElementsByTagName('td')[0];

    function handleClick(param) {
        if (!param.point) {
            return;
        }
        const rect = leftPriceScale.getBoundingClientRect();
        const offsetX = window.scrollX + rect.right;
        const offsetY = window.scrollY + rect.top;
        menu.style.left = `${offsetX + param.point.x}px`;
        menu.style.top = `${offsetY + param.point.y}px`;
        console.log(`click (${param.point.x}, ${param.point.y}) point, time ${param.time}`, param.seriesPrices);
    }
    chart.subscribeClick(handleClick);
}

function initDatetimepicker() {
    $('#datetimepicker1').datetimepicker({
        format: DATETIME_FORMAT,
        dayViewHeaderFormat: 'YYYY-MM',
        stepping: 5,
        sideBySide: true,
        useCurrent: false,
    });

    const datetimepickerInput = document.getElementById('datetimepicker-input');
    datetimepickerInput.addEventListener('blur', (event) => {
        const timestamp = moment.utc(event.target.value, DATETIME_FORMAT).unix();
        if (timestamp !== getCurrentChartTime()) {
            sendGotoAction(timestamp);
        }
    });
    datetimepickerInput.addEventListener('keydown', (event) => {
        if (event.code === 'Enter' || event.code === 'NumpadEnter') {
            event.target.blur();
        }
    });
};

window.onbeforeunload = function () {
    socket.close();
};
