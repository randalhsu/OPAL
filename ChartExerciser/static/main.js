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

function getLastPrice() {
    if (fetchedBars.length > 0) {
        return fetchedBars[fetchedBars.length - 1].close;
    }
    return NaN;
}

function getTickerInfo(ticker) {
    const currentTicker = ticker || document.getElementById('current-ticker').innerText;
    return tickersInfo[currentTicker];
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
        event.target.blur();
    }
    document.getElementById('fit-chart2-button').onclick = (event) => {
        fullUpdateSeriesPriceScales(candleSeries1, candleSeries2, candleSeries2);
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


const PRICE_LINE_COLOR = {
    alert: 'rgba(0, 86, 179, 1)',
    buy: 'rgba(53, 162, 74, 1)',
    sell: 'rgba(229, 37, 69, 1)',
};

function getPriceLineType(priceLine) {
    function getKeyByValue(object, value) {
        return Object.keys(object).find(key => object[key] === value);
    }
    return getKeyByValue(PRICE_LINE_COLOR, priceLine.options().color);
}

function customPriceLineDraggedHandler(params) {
    const priceLine = params.customPriceLine;
    const type = getPriceLineType(priceLine);

    if (type === 'alert') {
        syncDraggablePriceLines(alerts, priceLine, params.fromPriceString);
        updateAlertPricesTable();
    } else if (DIRECTION_TYPES.includes(type)) {
        syncDraggablePriceLines(orders, priceLine, params.fromPriceString);
        updateOrdersTable();
    }
}

function syncDraggablePriceLines(collections, draggedPriceLine, fromPriceString) {
    const series = (draggedPriceLine.series() === candleSeries1.series() ? candleSeries1 : candleSeries2);
    const newPrice = draggedPriceLine.options().price;
    const type = getPriceLineType(draggedPriceLine);

    for (const object of collections) {
        if (object.type !== type) {
            continue;
        }
        if (series === candleSeries1) {
            const priceLine = object.series2PriceLine;
            const price = priceLine.options().price;
            if (chart2.priceScale('right').formatPrice(price) === fromPriceString) {
                priceLine.applyOptions({ price: newPrice });
                object.priceString = chart1.priceScale('left').formatPrice(newPrice);
                return;
            }
        } else {
            const priceLine = object.series1PriceLine;
            const price = priceLine.options().price;
            if (chart1.priceScale('left').formatPrice(price) === fromPriceString) {
                priceLine.applyOptions({ price: newPrice });
                object.priceString = chart2.priceScale('right').formatPrice(newPrice);
                return;
            }
        }
    }
}

chart1.subscribeCustomPriceLineDragged(customPriceLineDraggedHandler);
chart2.subscribeCustomPriceLineDragged(customPriceLineDraggedHandler);


let alertId = 1;
let alerts = [];

class Alert {
    constructor(priceString) {
        if (priceString === null) {
            throw new TypeError('invalid params');
        }
        this.type = 'alert';
        this.priceString = priceString;
        this.id = alertId++;
        this.series1PriceLine = null;
        this.series2PriceLine = null;
    }
}

function addAlert(priceString) {
    if (priceString === null) {
        return;
    }
    if (alerts.map(alert => alert.priceString).includes(priceString)) {
        return;
    }

    const priceLineOptions = {
        price: +priceString,
        color: PRICE_LINE_COLOR.alert,
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Dotted,
        draggable: true,
    };
    const alert = new Alert(priceString);
    alert.series1PriceLine = candleSeries1.createPriceLine(priceLineOptions);
    alert.series2PriceLine = candleSeries2.createPriceLine(priceLineOptions);
    alerts.push(alert);

    updateAlertPricesTable();
    showMessage(`🔔 ${priceString}`, 1500);
}

function removeAlert(alert) {
    candleSeries1.removePriceLine(alert.series1PriceLine);
    candleSeries2.removePriceLine(alert.series2PriceLine);
    alerts = alerts.filter(a => a !== alert);
    updateAlertPricesTable();
}

function removeAllAlerts() {
    alerts.forEach(alert => removeAlert(alert));
}

function createEmptyLi() {
    const li = document.createElement('li');
    li.setAttribute('class', 'list-group-item');
    li.innerHTML = '(Empty)';
    return li;
}

function updateAlertPricesTable() {
    const ul = document.getElementById('alert-prices-ul');
    while (ul.firstChild) {
        ul.removeChild(ul.firstChild);
    }

    const titleLi = document.createElement('li');
    titleLi.setAttribute('class', 'list-group-item list-group-item-info');
    titleLi.innerHTML = `
        <i class="fa fa-bell" aria-hidden="true"></i>
        &nbsp;&nbsp;Alert Prices
        <button type="button" class="close" aria-label="Remove" title="Remove all alerts"><span aria-hidden="true">&times;</span></button>
    `;
    titleLi.getElementsByTagName('button')[0].onclick = () => removeAllAlerts();
    ul.appendChild(titleLi);

    if (alerts.length === 0) {
        ul.appendChild(createEmptyLi());
    } else {
        alerts.sort((a, b) => (+b.priceString) - (+a.priceString));
        for (const alert of alerts) {
            const li = document.createElement('li');
            li.setAttribute('class', 'list-group-item list-group-item-primary');
            li.innerHTML = `
                ${alert.priceString}
                <button type="button" class="close" aria-label="Remove" title="Remove alert"><span aria-hidden="true">&times;</span></button>
            `;
            li.getElementsByTagName('button')[0].onclick = () => removeAlert(alert);
            ul.appendChild(li);
        }
    }
}

function checkIfAlertTriggered() {
    let hasTriggeredAlert = false;
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

        for (const alert of alerts) {
            const price = +alert.priceString;
            if (low <= price && price <= high) {
                showMessage(`🔔 ${alert.priceString} triggered!`, 2000);
                removeAlert(alert);
                hasTriggeredAlert = true;
            }
        }
    }
    if (hasTriggeredAlert) {
        beep();
    }
    return hasTriggeredAlert;
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
}


const DIRECTION_TYPES = ['buy', 'sell'];
let orderId = 1;
let orders = [];

class Order {
    constructor(type, priceString) {
        if (!DIRECTION_TYPES.includes(type) || priceString === null) {
            throw new TypeError('invalid params');
        }
        this.type = type;
        this.priceString = priceString;
        this.id = orderId++;
        this.series1PriceLine = null;
        this.series2PriceLine = null;
    }
}

function addOrder(type, priceString) {
    if (priceString === null) {
        return;
    }

    const priceLineOptions = {
        price: +priceString,
        color: PRICE_LINE_COLOR[type],
        lineStyle: LightweightCharts.LineStyle.Solid,
        draggable: true,
    };
    const order = new Order(type, priceString);
    order.series1PriceLine = candleSeries1.createPriceLine(priceLineOptions);
    order.series2PriceLine = candleSeries2.createPriceLine(priceLineOptions);
    orders.push(order);

    showMessage(`Pending ${type} order @ ${priceString}`, 2000);
    updateOrdersTable();
}

function removeOrder(order) {
    candleSeries1.removePriceLine(order.series1PriceLine);
    candleSeries2.removePriceLine(order.series2PriceLine);
    orders = orders.filter(o => o !== order);
    updateOrdersTable();
}

function removeAllOrders() {
    orders.forEach(order => removeOrder(order));
}

function checkIfOrderTriggered() {
    let hasTriggeredOrder = false;
    if (fetchedBars.length >= 2) {
        const lastBar = fetchedBars[fetchedBars.length - 1];
        const secondLastBar = fetchedBars[fetchedBars.length - 2];
        const isAscending = lastBar.open > secondLastBar.close;

        orders.sort((a, b) => (+a.priceString) - (+b.priceString));
        positions.sort((a, b) => a.id - b.id);
        if (!isAscending) {
            orders.reverse();
        }

        for (const order of orders) {
            const price = +order.priceString;
            const isTriggeredByGap =
                (isAscending && (secondLastBar.close < price && price <= lastBar.open)) ||
                (!isAscending && (secondLastBar.close > price && price >= lastBar.open));

            if (isTriggeredByGap) {
                activateOrder(order, lastBar.open);
                hasTriggeredOrder = true;
            } else if (lastBar.low <= price && price <= lastBar.high) {
                activateOrder(order, price);
                hasTriggeredOrder = true;
            }
        }
    }
    return hasTriggeredOrder;
}

function isPairingDirections(obj1, obj2) {
    return (obj1.type === 'buy' && obj2.type === 'sell') ||
        (obj1.type === 'sell' && obj2.type === 'buy');
}

function activateOrder(order, triggeredPrice) {
    let hasClosedAPosition = false;
    for (const position of positions) {
        if (position.status === 'running' && isPairingDirections(order, position)) {
            position.setClosedPrice(triggeredPrice);
            hasClosedAPosition = true;
            break;
        }
    }
    if (!hasClosedAPosition) {
        openPosition(order.type, triggeredPrice);
    }
    removeOrder(order);
}

function updateOrdersTable() {
    const ul = document.getElementById('orders-ul');
    while (ul.firstChild) {
        ul.removeChild(ul.firstChild);
    }

    const titleLi = document.createElement('li');
    titleLi.setAttribute('class', 'list-group-item list-group-item-info');
    titleLi.innerHTML = `
        <i class="fa fa-book" aria-hidden="true"></i>
        &nbsp;&nbsp;Orders&nbsp;&nbsp;[Distance]
        <button type="button" class="close" aria-label="Remove" title="Remove all orders"><span aria-hidden="true">&times;</span></button>
    `;
    titleLi.getElementsByTagName('button')[0].onclick = () => removeAllOrders();
    ul.appendChild(titleLi);

    if (orders.length === 0) {
        ul.appendChild(createEmptyLi());
    } else {
        const lastPrice = getLastPrice();
        const tickerInfo = getTickerInfo();
        orders.sort((a, b) => (+b.priceString) - (+a.priceString));

        for (const order of orders) {
            const li = document.createElement('li');
            li.setAttribute('class', 'list-group-item');
            if (order.type === 'buy') {
                li.classList.add('list-group-item-success');
            } else {
                li.classList.add('list-group-item-danger');
            }
            const orderPrice = +order.priceString;
            let distanceTicks = Math.floor((lastPrice - orderPrice) / tickerInfo.minMove);
            const arrow = distanceTicks > 0 ? '🡶' : distanceTicks < 0 ? '🡵' : '🡲';
            distanceTicks = Math.abs(distanceTicks);
            const distanceDollars = (distanceTicks * tickerInfo.tickValue).toFixed(tickerInfo.precision);

            li.innerHTML = `
                ${order.type} @ ${order.priceString}&nbsp;&nbsp[${arrow} ${distanceTicks} ticks / $${distanceDollars}]
                <button type="button" class="close" aria-label="Remove" title="Remove order"><span aria-hidden="true">&times;</span></button>
            `;
            li.getElementsByTagName('button')[0].onclick = () => removeOrder(order);
            ul.appendChild(li);
        }
    }
}


function convertPriceToString(price, precision) {
    precision = precision || getTickerInfo().precision;
    if (price >= 0) {
        return price.toFixed(precision);
    }
    return `(${Math.abs(price).toFixed(precision)})`;
}

let positionId = 1;
let positions = [];

class Position {
    constructor(type, openedPrice) {
        if (!DIRECTION_TYPES.includes(type) || openedPrice === undefined) {
            throw new TypeError('invalid params');
        }
        this.type = type;
        this.openedPrice = openedPrice;
        this.closedPrice = null;
        this.id = positionId++;
    }
    setClosedPrice(price) {
        this.closedPrice = price;
    }
    get status() {
        if (this.closedPrice === null) {
            return 'running';
        }
        return 'closed';
    }
    calculatePL() {
        const tickerInfo = getTickerInfo();
        const endPrice = this.closedPrice || getLastPrice();
        let steps = (endPrice - this.openedPrice) / tickerInfo.minMove;
        if (this.type === 'sell') {
            steps = -steps;
        }
        return steps * tickerInfo.tickValue;
    }
    toString() {
        const openedPrice = convertPriceToString(this.openedPrice);
        let closedPrice = '';
        if (this.closedPrice !== null) {
            let arrow = '🡲';
            if (this.openedPrice < this.closedPrice) {
                arrow = '🡵';
            } else if (this.openedPrice > this.closedPrice) {
                arrow = '🡶';
            }
            closedPrice = ` ${arrow} ${convertPriceToString(this.closedPrice)}`;
        }
        let pl = this.calculatePL();
        pl = convertPriceToString(pl);
        return `${this.type} @ ${openedPrice}${closedPrice}&nbsp;&nbsp;[$${pl}]`;
    }
}

function calculatePositionsTotalPL() {
    return positions.map(p => p.calculatePL()).reduce((sum, current) => sum + current, 0);
}

function openPosition(type, openedPrice) {
    positions.push(new Position(type, openedPrice));
}

function closePosition(position, closedPrice) {
    closedPrice = closedPrice || getLastPrice();
    position.setClosedPrice(closedPrice);
    updatePositionsTable();
}

function removePosition(position) {
    positions = positions.filter(p => p !== position);
    updatePositionsTable();
}

function removeAllClosedPositions() {
    positions = positions.filter(position => position.status === 'running');
    updatePositionsTable();
}

function removeAllPositions() {
    for (const position of positions) {
        if (position.status === 'running') {
            position.setClosedPrice(getLastPrice());
        }
    }
    removeAllClosedPositions();
}

function updatePositionsTable() {
    const ul = document.getElementById('positions-ul');
    while (ul.firstChild) {
        ul.removeChild(ul.firstChild);
    }

    const titleLi = document.createElement('li');
    titleLi.setAttribute('class', 'list-group-item list-group-item-info');
    let totalPLString = '';
    if (positions.length > 0) {
        const totalPL = calculatePositionsTotalPL();
        totalPLString = `: $${convertPriceToString(totalPL)}`;
    }
    titleLi.innerHTML = `
        <i class="fa fa-rocket" aria-hidden="true"></i>
        &nbsp;&nbsp;Positions [P/L${totalPLString}]
        <button type="button" class="close" aria-label="Dismiss" title="Dismiss all closed positions"><span aria-hidden="true">&times;</span></button>
    `;
    titleLi.getElementsByTagName('button')[0].onclick = () => removeAllClosedPositions();
    ul.appendChild(titleLi);

    if (positions.length === 0) {
        ul.appendChild(createEmptyLi());
    } else {
        positions.sort((a, b) => b.id - a.id);
        for (const position of positions) {
            let class_ = '';
            let title = 'Dismiss';
            let fn = removePosition;
            if (position.status === 'running') {
                class_ = 'list-group-item-warning';
                title = 'Close';
                fn = closePosition;
            } else {
                const pl = position.calculatePL();
                if (pl >= 0) {
                    class_ = 'list-group-item-success';
                } else {
                    class_ = 'list-group-item-danger';
                }
            }

            const li = document.createElement('li');
            li.setAttribute('class', 'list-group-item');
            li.classList.add(class_);
            li.innerHTML = `
                ${position}
                <button type="button" class="close" aria-label="${title}" title="${title} position"><span aria-hidden="true">&times;</span></button>
            `;
            li.getElementsByTagName('button')[0].onclick = () => fn(position);
            ul.appendChild(li);
        }
    }
}


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

function updateDatetimepickerCurrentDatetime(timestamp) {
    //TODO: locale bug when near final bar
    if (typeof timestamp === 'number') {
        const time = moment.utc(timestamp * 1000);
        $('#datetimepicker1').datetimepicker('date', time);
        document.getElementById('weekday').innerText = `[${time.format('ddd')}]`;
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
    LIMIT_N_BARS: 24,
}

function resetFastForwardStatus() {
    fastForwardStatus.isFastForwarding = false;
    fastForwardStatus.fastForwardedBars = 0;
}

function checkIfContinueFastForwardJourney(hasTriggeredPriceLine) {
    if (hasTriggeredPriceLine) {
        resetFastForwardStatus();
        return;
    }
    if (!fastForwardStatus.isFastForwarding) {
        return;
    }
    fastForwardStatus.fastForwardedBars += 1;
    if (fastForwardStatus.fastForwardedBars >= fastForwardStatus.LIMIT_N_BARS) {
        resetFastForwardStatus();
        return;
    }
    sendStepAction();
}


const socket = new WebSocket(`ws://${window.location.host}/socket`);

socket.onopen = function (e) {
    initDatetimepicker();
    registerChangeTickerHandler();
    registerKeyboardEventHandler();
    registerFitButtonsHandler();
    updateAlertPricesTable();
    updateOrdersTable();
    updatePositionsTable();

    sendInitAction();
    sendSwitchAction('MES');
}

socket.onmessage = function (e) {
    if (e.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
            const s = reader.result;
            let data = new Array(s.length);
            for (let i = 0; i < s.length; ++i) {
                data[i] = s.charCodeAt(i);
            }
            const response = JSON.parse(pako.inflate(data, { to: 'string' }));
            handleResponse(response);
        };
        reader.readAsBinaryString(e.data);
    } else {
        handleResponse(JSON.parse(e.data));
    }
}

function handleResponse(response) {
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
            const lastBarTriggeredOrder = checkIfOrderTriggered();
            const hasTriggeredPriceLine = lastBarTriggeredAlert || lastBarTriggeredOrder;
            checkIfContinueFastForwardJourney(hasTriggeredPriceLine);

            updateOrdersTable();
            updatePositionsTable();
            break;

        case 'stepback':
            // do nothing
            break;

        case 'switch':
        case 'goto':
            removeAllAlerts();
            removeAllOrders();
            removeAllPositions();
            resetFastForwardStatus();

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
                const maxDate = getTickerInfo().maxDate;
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
                // Fast forward until triggered any alert, or at most LIMIT_N_BARS,
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
                addAlert(mouseHoverPriceString);
                break;

            case 'KeyB':
                addOrder('buy', mouseHoverPriceString);
                break;

            case 'KeyS':
                addOrder('sell', mouseHoverPriceString);
                break;
        }
    }, true);
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
    document.getElementsByClassName('input-group-append')[0].addEventListener('click', (event) => {
        datetimepickerInput.focus();
        datetimepickerInput.setSelectionRange(0, datetimepickerInput.value.length);
    });
}

window.onbeforeunload = function () {
    socket.close();
};
