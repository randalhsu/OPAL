'use strict';

const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';
const DATA_TIMEZONE = 'America/New_York';
const DATA_UTC_OFFSET_HOUR = -5;  // EST
const DATA_DAILY_OPEN_HOUR = 18;

const DEFAULT_CONFIGS = {
    UTCOffsetHour: '8',
    ticker: 'MES',
    muteSound: false,
    bgColor: '000000',
    axesTextColor: 'FFFFFF',
    dailyOpenPriceColor: 'CFA600',
    upColor: '00B061',
    wickUpColor: '00B061',
    borderUpColor: '00B061',
    downColor: 'FF3031',
    wickDownColor: 'FF3031',
    borderDownColor: 'FF3031',
    sma11Period: '0',
    sma11Color: 'DDDDDD',
    sma21Period: '0',
    sma21Color: '007BFF',
    sma22Period: '0',
    sma22Color: '17A2B8',
    sma23Period: '0',
    sma23Color: '6C757D',
    ema21Period: '0',
    ema21Color: '6C757D',
    ema22Period: '0',
    ema22Color: '17A2B8',
    ema23Period: '0',
    ema23Color: '007BFF',
};

const configs = { ...DEFAULT_CONFIGS };

const MOBILE_MODE_PATHNAME = '/m';
let isMobileMode = false;

(function updateConfigsFromURL() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    for (const [key, value] of params) {
        if (configs.hasOwnProperty(key)) {
            configs[key] = value;
        }
    }
    isMobileMode = (url.pathname === MOBILE_MODE_PATHNAME);
})();


function getHexColor(s) {
    const isHexColor = str => (/^[0-9A-Fa-f]{6}$/i).test(str);
    return (isHexColor(s) ? '#' + s : '#000000');
}

function getNonDefaultConfigsParams() {
    const params = new URLSearchParams();
    for (const [key, defaultValue] of Object.entries(DEFAULT_CONFIGS)) {
        if (configs[key] !== defaultValue) {
            params.append(key, configs[key]);
        }
    }
    return params;
}

function updateLinkToCurrentTickerAndTimestamp() {
    const params = getNonDefaultConfigsParams();
    params.set('ticker', getCurrentTicker());
    params.set('timestamp', getCurrentChartTime());

    const url = new URL(document.location.href);
    const newURL = `${url.origin}${url.pathname}?${params.toString()}`;
    document.getElementById('freeze-status-link').setAttribute('href', newURL);
}

(function prepareOptionsModal() {

    function updateNewURLDisplay() {
        const paramsString = getNonDefaultConfigsParams().toString();
        const url = new URL(document.location.href);
        let html = '';
        if (paramsString) {
            const newURL = `${url.origin}${url.pathname}?${paramsString}`;
            html = `
                <span class="text-danger">⚠️ Use this link to take effect:</span><br/>
                <a href="${newURL}" target="_blank">${newURL}</a> <i class="fa fa-external-link" aria-hidden="true"></i>
            `;
        }
        document.getElementById('new-url').innerHTML = html;

        if (url.pathname !== MOBILE_MODE_PATHNAME) {
            const mobileLinkURL = `${url.origin}${MOBILE_MODE_PATHNAME}?${paramsString}`;
            const mobileLinkHtml = `[<a href="${mobileLinkURL}" target="_blank">Mobile mode <i class="fa fa-external-link" aria-hidden="true"></i></a>]`;
            document.getElementById('mobile-mode-url').innerHTML = mobileLinkHtml;
        }
    }

    function applyCandleColor(part, hexColorString) {
        const options = {};
        options[part] = hexColorString;
        candleSeries1.applyOptions(options);
        candleSeries2.applyOptions(options);
    }

    const defaultTickerSelect = document.getElementById('default-ticker-select');
    defaultTickerSelect.value = configs.ticker;
    defaultTickerSelect.addEventListener('change', (event) => {
        configs.ticker = event.target.value;
        updateNewURLDisplay();
    });

    const UTCTimeOffsetSelect = document.getElementById('utc-time-offset');
    for (let offset = 14; offset >= -12; --offset) {
        const s = offset.toString();
        const option = document.createElement('option');
        option.value = s;
        option.innerText = offset > 0 ? '+' + s : s;
        UTCTimeOffsetSelect.appendChild(option);
    }
    UTCTimeOffsetSelect.value = configs.UTCOffsetHour;
    UTCTimeOffsetSelect.addEventListener('change', (event) => {
        configs.UTCOffsetHour = event.target.value;
        updateNewURLDisplay();
    });

    const muteSoundCheckbox = document.getElementById('mute-sound-checkbox');
    muteSoundCheckbox.checked = configs.muteSound;
    muteSoundCheckbox.addEventListener('change', (event) => {
        configs.muteSound = event.target.checked;
        updateNewURLDisplay();
    });

    const colorPickerOptions = {
        preferredFormat: 'hex',
        showInput: true,
        showPalette: true,
        cancelText: 'Cancel',
        chooseText: 'Choose',
        palette: [
            ['#26A69A', '#EF5350', '#03FD04', '#FE0000'],
            ['#00B061', '#FF3031', '#0EA600', '#FF0000'],
            ['#FFFFFF', '#252930', '#DDDDDD', '#7E838C'],
            ['#007BFF', '#6C757D', '#FFC107', '#17A2B8'],
        ],
    };

    colorPickerOptions.color = getHexColor(configs.bgColor);
    colorPickerOptions.change = (color) => {
        configs.bgColor = color.toHex().toUpperCase();
        const options = { layout: { backgroundColor: color.toHexString() } };
        chart1.applyOptions(options);
        chart2.applyOptions(options);
        updateNewURLDisplay();
    }
    $('#color-bg').spectrum(colorPickerOptions);

    colorPickerOptions.color = getHexColor(configs.axesTextColor);
    colorPickerOptions.change = (color) => {
        configs.axesTextColor = color.toHex().toUpperCase();
        const options = { layout: { textColor: color.toHexString() } };
        chart1.applyOptions(options);
        chart2.applyOptions(options);
        updateNewURLDisplay();
    }
    $('#color-axes-text').spectrum(colorPickerOptions);

    colorPickerOptions.color = getHexColor(configs.dailyOpenPriceColor);
    colorPickerOptions.change = (color) => {
        configs.dailyOpenPriceColor = color.toHex().toUpperCase();
        drawDailyOpenPrice();
        updateNewURLDisplay();
    }
    $('#color-dailyOpenPrice').spectrum(colorPickerOptions);

    for (const ma of ['sma11', 'sma21', 'sma22', 'sma23', 'ema21', 'ema22', 'ema23']) {
        const maPeriodInput = document.getElementById(`${ma}-period`);
        maPeriodInput.value = configs[`${ma}Period`];
        maPeriodInput.addEventListener('change', (event) => {
            if (maPeriodInput.checkValidity()) {
                configs[`${ma}Period`] = event.target.value;
                updateMA();
                updateNewURLDisplay();
            }
        });

        colorPickerOptions.color = getHexColor(configs[`${ma}Color`]);
        colorPickerOptions.change = (color) => {
            configs[`${ma}Color`] = color.toHex().toUpperCase();
            updateMA();
            updateNewURLDisplay();
        }
        $(`#color-${ma}`).spectrum(colorPickerOptions);
    }

    const mapping = {
        'upColor': getHexColor(configs.upColor),
        'wickUpColor': getHexColor(configs.wickUpColor),
        'borderUpColor': getHexColor(configs.borderUpColor),
        'downColor': getHexColor(configs.downColor),
        'wickDownColor': getHexColor(configs.wickDownColor),
        'borderDownColor': getHexColor(configs.borderDownColor),
    };
    for (const [part, configuredColor] of Object.entries(mapping)) {
        colorPickerOptions.color = configuredColor;
        colorPickerOptions.change = (color) => {
            configs[part] = color.toHex().toUpperCase();
            applyCandleColor(part, color.toHexString());
            updateNewURLDisplay();
        }
        $(`#color-${part}`).spectrum(colorPickerOptions);
    }

    updateNewURLDisplay();
})();


function getUTCOffsetHours() {
    let UTCOffsetHour = parseInt(configs.UTCOffsetHour);
    if (isNaN(UTCOffsetHour)) {
        UTCOffsetHour = DATA_UTC_OFFSET_HOUR;
    }
    return UTCOffsetHour - DATA_UTC_OFFSET_HOUR;
}

function getUTCOffsetSeconds() {
    return getUTCOffsetHours() * 3600;
}

function isDST(timestamp) {
    return moment(timestamp * 1000).tz(DATA_TIMEZONE).isDST();
}

function getDSTOffsetHours(timestamp) {
    return isDST(timestamp) ? -1 : 0;
}

function getDSTOffsetSeconds(timestamp) {
    return getDSTOffsetHours(timestamp) * 3600;
}

function convertClientTimestampToServerTimestamp(timestamp) {
    timestamp -= getUTCOffsetSeconds();
    timestamp -= getDSTOffsetSeconds(timestamp);
    return timestamp;
}

function convertServerTimestampToClientTimestamp(timestamp) {
    timestamp += getDSTOffsetSeconds(timestamp);
    timestamp += getUTCOffsetSeconds();
    return timestamp;
}

function convertTimestampToStringInUTC(timestamp) {
    return moment.utc(timestamp * 1000).format(DATETIME_FORMAT);
}

let tickersInfo = {};
let fetchedBars = [];
let displayBars = [];


const chartWidth = Math.floor(document.body.clientWidth * 0.95 / 2);
const chartHeight = Math.floor(chartWidth * 0.7);

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
        backgroundColor: getHexColor(configs.bgColor),
        textColor: getHexColor(configs.axesTextColor),
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
        rightBarStaysOnScroll: true,
        borderColor: 'rgba(197, 203, 206, 0.8)',
        timeVisible: true,
        secondsVisible: false,
    },
};

const chart1 = LightweightCharts.createChart(document.getElementById('chart1'), chartOptions);
chartOptions.priceScale.position = 'right';
const chart2 = LightweightCharts.createChart(document.getElementById('chart2'), chartOptions);


let isDraggingChartResizer = false;
let draggingChartResizer = null;

(function initChartResizersPosition() {
    const resizer1 = document.getElementById('chart1-resizer');
    const resizer2 = document.getElementById('chart2-resizer');
    resizer1.chartEl = document.getElementById('chart1');
    resizer2.chartEl = document.getElementById('chart2');
    moveResizerToBottomRightEdgeOfChart(resizer1);
    moveResizerToBottomRightEdgeOfChart(resizer2);
})();

function moveResizerToBottomRightEdgeOfChart(resizer) {
    const resizerRect = resizer.getBoundingClientRect();
    const chartRect = resizer.chartEl.querySelector('.tv-lightweight-charts').getBoundingClientRect();
    const offsetX = chartRect.right - resizerRect.width;
    const offsetY = window.scrollY + chartRect.bottom - resizerRect.height;
    resizer.style.left = `${offsetX}px`;
    resizer.style.top = `${offsetY}px`;
}

function registerChartResizersHandler() {
    if (isMobileMode) {
        return;
    }

    const resetResizer = (resizer) => {
        resizer.style.cursor = 'grab';
        resizer.onmousemove = null
    }

    const resizer1 = document.getElementById('chart1-resizer');
    const resizer2 = document.getElementById('chart2-resizer');
    resizer1.chart = chart1;
    resizer2.chart = chart2;

    for (const resizer of [resizer1, resizer2]) {
        const chart = resizer.chart;
        resetResizer(resizer);

        resizer.addEventListener('mousedown', (e) => {
            isDraggingChartResizer = true;
            draggingChartResizer = resizer;

            resizer.style.cursor = 'grabbing';
            const chartResizeFromWidth = chart.options().width;
            const chartResizeFromHeight = chart.options().height;
            const rect = resizer.getBoundingClientRect();
            resizer.deltaX = e.clientX - rect.x;
            resizer.deltaY = e.clientY - rect.y;
            resizer.dragStartX = rect.x;
            resizer.dragStartY = rect.y;

            resizer.onmousemove = (e) => {
                resizer.style.left = `${e.clientX - resizer.deltaX}px`;
                resizer.style.top = `${e.clientY - resizer.deltaY}px`;
                const movedX = e.clientX - resizer.dragStartX - resizer.deltaX;
                const movedY = e.clientY - resizer.dragStartY - resizer.deltaY;
                chart.resize(chartResizeFromWidth + movedX, chartResizeFromHeight + movedY);

                const anotherResizer = resizer === resizer1 ? resizer2 : resizer1;
                moveResizerToBottomRightEdgeOfChart(anotherResizer);
            }
            resizer.onmousemoveBackup = resizer.onmousemove;
        });

        resizer.addEventListener('mouseup', (e) => {
            isDraggingChartResizer = false;
            draggingChartResizer = null;
            resetResizer(resizer);
        });
    }

    // Workaround for dragging too fast and mouse left the resizer while still dragging
    window.addEventListener('mousemove', (e) => {
        if (isDraggingChartResizer) {
            const resizer = draggingChartResizer;
            resizer.style.left = `${e.clientX - resizer.deltaX}px`;
            resizer.style.top = `${e.clientY - resizer.deltaY}px`;
            resizer.onmousemoveBackup(e);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isDraggingChartResizer) {
            isDraggingChartResizer = false;
            draggingChartResizer = null;
            resetResizer(draggingChartResizer);
        }
    });
}


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

let pointerOverChart1 = false;
let pointerOverChart2 = false;
let pointerHoverPriceString = null;
let pointerHoverTimestamp = null;

function registerChartsPointerEventHandler() {
    const chart1El = document.getElementById('chart1').querySelector('.tv-lightweight-charts').querySelectorAll('td')[1];
    chart1El.addEventListener('pointerenter', () => {
        pointerOverChart1 = true;
        pointerOverChart2 = false;
    });

    chart1El.addEventListener('pointermove', () => {
        pointerOverChart1 = true;
        pointerOverChart2 = false;
    });

    chart1El.addEventListener('mouseleave', () => {
        if (isMobileMode) {
            return;
        }
        pointerOverChart1 = false;
        chart2.clearCrossHair();
        pointerHoverPriceString = null;
        pointerHoverTimestamp = null;
        updateInfoPanel();
    });

    const chart2El = document.getElementById('chart2').querySelector('.tv-lightweight-charts').querySelectorAll('td')[1];
    chart2El.addEventListener('pointerenter', () => {
        pointerOverChart1 = false;
        pointerOverChart2 = true;
    });
    chart2El.addEventListener('pointermove', () => {
        pointerOverChart1 = false;
        pointerOverChart2 = true;
    });
    chart2El.addEventListener('mouseleave', () => {
        if (isMobileMode) {
            return;
        }
        pointerOverChart2 = false;
        chart1.clearCrossHair();
        pointerHoverPriceString = null;
        pointerHoverTimestamp = null;
        updateInfoPanel();
    });
}

function crosshair1SyncHandler(e) {
    if (!pointerOverChart1 || e.point === undefined) {
        if (pointerOverChart1) {
            chart2.clearCrossHair();
        }
        pointerHoverPriceString = null;
        pointerHoverTimestamp = null;
        return;
    }

    const xx = e.time === undefined ? 0 : chart2.timeScale().timeToCoordinate(e.time);
    const price = candleSeries1.coordinateToPrice(e.point.y);
    const yy = candleSeries2.priceToCoordinate(price);
    chart2.setCrossHairXY(xx, yy, true);
    pointerHoverPriceString = chart1.priceScale('left').formatPrice(price);
    pointerHoverTimestamp = chart1.timeScale().coordinateToTime(e.point.x);
    updateInfoPanel(e);
}

function crosshair2SyncHandler(e) {
    if (!pointerOverChart2 || e.point === undefined) {
        if (pointerOverChart2) {
            chart1.clearCrossHair();
        }
        pointerHoverPriceString = null;
        pointerHoverTimestamp = null;
        return;
    }

    const xx = e.time === undefined ? 0 : chart1.timeScale().timeToCoordinate(e.time - (e.time % 3600));
    const price = candleSeries2.coordinateToPrice(e.point.y);
    const yy = candleSeries1.priceToCoordinate(price);
    chart1.setCrossHairXY(xx, yy, true);
    pointerHoverPriceString = chart2.priceScale('right').formatPrice(price);
    pointerHoverTimestamp = chart2.timeScale().coordinateToTime(e.point.x);
    updateInfoPanel(e);
}

let shouldDisplayInfoPanel = false;

function updateInfoPanel(param) {
    const panel = document.getElementById('info-panel');
    if (!shouldDisplayInfoPanel || getCurrentTicker() === '' ||
        !(pointerOverChart1 || pointerOverChart2)) {
        panel.style.display = 'none';
        return;
    }
    if (param === undefined) {
        panel.style.display = shouldDisplayInfoPanel ? 'table' : 'none';
        return;
    }

    const chart = pointerOverChart1 ? chart1 : chart2;
    const width = chart.options().width;
    const height = chart.options().height;
    if (!param.time ||
        param.point.x < 0 || param.point.x > width ||
        param.point.y < 0 || param.point.y > height) {
        panel.style.display = 'none';
        return;
    }

    const prices = param.seriesPrices.get(pointerOverChart1 ? candleSeries1 : candleSeries2);
    if (prices === undefined) {
        return;
    }
    const precision = getTickerInfo().precision;
    let smaContent = '';
    for (const sma of ['sma11', 'sma21', 'sma22', 'sma23']) {
        if ((pointerOverChart1 && sma[3] === '2') ||
            (pointerOverChart2 && sma[3] === '1')) {
            continue;
        }
        const chart = sma[3] === '1' ? chart1 : chart2;
        const period = configs[`${sma}Period`];
        if (period < 1) {
            continue;
        }
        const smaPrice = param.seriesPrices.get(chart[`${sma}LineSeries`]);
        if (smaPrice === undefined) {
            continue;
        }
        smaContent += `SMA(${period}): ${smaPrice.toFixed(precision)}<br/>`;
    }

    const price = +pointerHoverPriceString;
    const tickerInfo = getTickerInfo();
    let distanceTicks = Math.floor((getLastPrice() - price) / tickerInfo.minMove);
    const arrow = distanceTicks > 0 ? '➘' : distanceTicks < 0 ? '➚' : '➙';
    distanceTicks = Math.abs(distanceTicks);
    const distanceDollars = convertDollarsToString(distanceTicks * tickerInfo.tickValue);
    const distanceContent = `${arrow} ${distanceTicks} ticks<br/>${arrow} $${distanceDollars}`;

    panel.innerHTML = `
        <div class="text-center" style="height:max-content">
            <div>O: ${prices.open.toFixed(precision)}</div>
            <div>H: ${prices.high.toFixed(precision)}</div>
            <div>L: ${prices.low.toFixed(precision)}</div>
            <div>C: ${prices.close.toFixed(precision)}</div>
            <p style="font-size:0.9em;margin:4px">${smaContent}</p>
            <p style="font-size:0.9em;margin:4px">${distanceContent}</p>
        </div>
    `;

    const chartEl = document.getElementById(pointerOverChart1 ? 'chart1' : 'chart2');
    const chartRect = chartEl.querySelector('.tv-lightweight-charts').getBoundingClientRect();
    const leftPriceScaleWidth = chartEl.querySelector('td').getBoundingClientRect().width;
    const timeScaleHeight = chartEl.querySelectorAll('tr')[1].getBoundingClientRect().height;
    const chartLeft = chartRect.left + leftPriceScaleWidth;
    const margin = 15;

    let left = chartLeft + param.point.x - margin - panel.offsetWidth;
    if (left < chartLeft) {
        left = chartLeft + param.point.x + margin;
    }
    let top = chartRect.top + param.point.y + margin;
    if (top > chartRect.bottom - timeScaleHeight - panel.offsetHeight) {
        top = chartRect.top + param.point.y - margin - panel.offsetHeight;
    }

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.display = 'block';
}

chart1.subscribeCrosshairMove(crosshair1SyncHandler);
chart2.subscribeCrosshairMove(crosshair2SyncHandler);


const candleOptions = {
    priceLineVisible: false,
    upColor: getHexColor(configs.upColor),
    downColor: getHexColor(configs.downColor),
    borderDownColor: getHexColor(configs.borderDownColor),
    borderUpColor: getHexColor(configs.borderUpColor),
    wickDownColor: getHexColor(configs.wickDownColor),
    wickUpColor: getHexColor(configs.wickUpColor),
};

const candleSeries1 = chart1.addCandlestickSeries(candleOptions);
const candleSeries2 = chart2.addCandlestickSeries(candleOptions);
const candleSerieses = [candleSeries1, candleSeries2];

function getMinMax(arr) {
    let min = arr[0];
    let max = arr[0];
    let i = arr.length;
    while (i--) {
        min = arr[i] < min ? arr[i] : min;
        max = arr[i] > max ? arr[i] : max;
    }
    return { min, max };
}

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
            bar.high = getMinMax(filteredData.map(e => e.high)).max;
            bar.low = getMinMax(filteredData.map(e => e.low)).min;
            result.push(bar);
        }
    });
    return result;
}

function getLastDisplayBar(bars = displayBars) {
    if (bars.length > 0) {
        return bars[bars.length - 1];
    }
    return null;
}

function getSecondLastDisplayBar(bars = displayBars) {
    if (bars.length > 1) {
        return bars[bars.length - 2];
    }
    return null;
}

function getCurrentChartTime() {
    const bar = getLastDisplayBar();
    return bar === null ? null : bar.time;
}

function getLastPrice() {
    const bar = getLastDisplayBar();
    return bar === null ? NaN : bar.close;
}

function getCurrentTicker() {
    return document.getElementById('current-ticker').innerText;
}

function setCurrentTicker(ticker) {
    if (tickersInfo.hasOwnProperty(ticker)) {
        document.getElementById('current-ticker').innerText = ticker;
        updateDatetimepickerRange(ticker);
        return true;
    }
    return false;
}

function getTickerInfo(ticker) {
    const currentTicker = ticker || getCurrentTicker();
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
    if (barsInfo === null) {
        return;
    }
    const filteredData = displayBars.filter(
        e => barsInfo.from <= e.time && e.time <= barsInfo.to + oneBarTimeMarginInSeconds
    );

    const minPrice = getMinMax(filteredData.map(e => e.low)).min;
    const maxPrice = getMinMax(filteredData.map(e => e.high)).max;
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

for (const chart of [chart1, chart2]) {
    chart.timeScale().subscribeVisibleTimeRangeChange(() =>
        updateSeriesPriceScales(candleSeries1, candleSeries2, specifiedDominantSeries)
    );
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
    specifiedDominantSeries = undefined;
    fullUpdateSeriesPriceScales(candleSeries1, candleSeries2);
}

function drawDailyOpenPrice() {
    const localeHourDiff = new Date().getTimezoneOffset() / 60;
    const userDailyOpenHour = (DATA_DAILY_OPEN_HOUR + getUTCOffsetHours() + getDSTOffsetHours(getCurrentChartTime()) + 24) % 24;

    for (let i = displayBars.length - 1; i >= 0; --i) {
        const date = new Date(displayBars[i].time * 1000);
        if ((date.getHours() + localeHourDiff + 24) % 24 === userDailyOpenHour && date.getMinutes() === 0) {
            const dailyOpenPrice = displayBars[i].open;
            for (const series of candleSerieses) {
                attachDailyOpenPriceLineToSeries(series, dailyOpenPrice);
            }
            return;
        }
    }
}

function attachDailyOpenPriceLineToSeries(series, price) {
    if (series.dailyOpenPriceLine !== undefined) {
        const options = series.dailyOpenPriceLine.options()
        if (price === options.price &&
            configs.dailyOpenPriceColor === options.color) {
            return;
        }
        series.removePriceLine(series.dailyOpenPriceLine);
    }
    series.dailyOpenPriceLine = series.createPriceLine({
        price: price,
        color: getHexColor(configs.dailyOpenPriceColor),
        lineWidth: 2,
        lineStyle: LightweightCharts.LineStyle.Solid,
    });
}

(function attachMALinesToCharts() {
    const lineOptions = {
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        baseLineVisible: false,
        lineWidth: 1,
    };
    for (const ma of ['sma11', 'sma21', 'sma22', 'sma23', 'ema21', 'ema22', 'ema23']) {
        const chart = ma[3] === '1' ? chart1 : chart2;
        lineOptions.color = getHexColor(DEFAULT_CONFIGS[`${ma}Color`]);
        chart[`${ma}LineSeries`] = chart.addLineSeries(lineOptions);
    }
})();

function calculateSMA(bars, period) {
    if (period < 1 || bars.length < period) {
        return [];
    }
    const avg = (array) => array.map(bar => bar.close).reduce((p, c, i) => p + (c - p) / (i + 1), 0);
    const result = [];
    for (let i = period - 1; i < bars.length; ++i) {
        const val = avg(bars.slice(i - period + 1, i + 1));
        result.push({ time: bars[i].time, value: val });
    }
    return result;
}

function calculateEMA(bars, period) {
    if (period < 1 || bars.length < period) {
        return [];
    }
    const k = 2 / (period + 1);
    const result = [{ time: bars[0].time, value: bars[0].close }];
    for (let i = 1; i < bars.length; ++i) {
        result.push({ time: bars[i].time, value: bars[i].close * k + result[i - 1].value * (1 - k) });
    }
    return result;
}

function updateMA() {
    for (const ma of ['sma11', 'sma21', 'sma22', 'sma23', 'ema21', 'ema22', 'ema23']) {
        const chart = ma[3] === '1' ? chart1 : chart2;
        const period = parseInt(configs[`${ma}Period`]);
        if (isNaN(period) || period < 1) {
            chart[`${ma}LineSeries`].setData([]);
            continue;
        }
        const bars = ma[3] === '1' ? hourlyBars : displayBars;
        const maData = (ma.startsWith('sma') ? calculateSMA(bars, period) : calculateEMA(bars, period));
        chart[`${ma}LineSeries`].applyOptions({ color: getHexColor(configs[`${ma}Color`]) });
        chart[`${ma}LineSeries`].setData(maData);
    }
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
        updateAlertsTable();
    } else if (DIRECTION_TYPES.includes(type)) {
        syncDraggablePriceLines(orders, priceLine, params.fromPriceString);
        updateOrdersTable();
    }
}

let lastPointerPosition = { x: null, y: null };

(function () {
    document.onpointermove = (e) => {
        lastPointerPosition = { x: e.clientX, y: e.clientY };
    };
})();

function syncDraggablePriceLines(collections, draggedPriceLine, fromPriceString) {
    const chart1RectRight = document.getElementById('chart1').getBoundingClientRect().right;
    const series = (lastPointerPosition.x < chart1RectRight ? candleSeries1 : candleSeries2);
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


let alerts = [];

class Alert {
    constructor(priceString) {
        if (priceString === null) {
            throw new TypeError('invalid params');
        }
        this.type = 'alert';
        this.priceString = priceString;
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

    updateAlertsTable();
    showMessage(`<i class="fa fa-bell" aria-hidden="true"></i> @ ${priceString}`);
}

function removeAlert(alert) {
    candleSeries1.removePriceLine(alert.series1PriceLine);
    candleSeries2.removePriceLine(alert.series2PriceLine);
    alerts = alerts.filter(a => a !== alert);
    updateAlertsTable();
}

function removeAllAlerts() {
    alerts.forEach(alert => removeAlert(alert));
}

function createEmptyLi() {
    const li = document.createElement('li');
    li.setAttribute('class', 'list-group-item');
    li.innerHTML = '<span class="text-muted">(Empty)</span>';
    return li;
}

function updateAlertsTable() {
    const ul = document.getElementById('alerts-ul');
    while (ul.firstChild) {
        ul.removeChild(ul.firstChild);
    }

    const titleLi = document.createElement('li');
    titleLi.setAttribute('class', 'list-group-item list-group-item-info d-flex');
    titleLi.innerHTML = `
        <span class="mr-3 align-middle"><i class="fa fa-bell" aria-hidden="true"></i></span>
        <span class="mr-2 flex-grow-1 text-nowrap">Alerts</span>
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
    if (displayBars.length >= 2) {
        const lastBar = displayBars[displayBars.length - 1];
        const secondLastBar = displayBars[displayBars.length - 2];
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
                showMessage(`<i class="fa fa-bell" aria-hidden="true"></i> @ ${alert.priceString} triggered!`);
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

let audioCtx = null;

function beep(frequency = 718, type = 'triangle', volume = 0.1, duration = 250) {
    if (configs.muteSound) {
        return;
    }
    if (audioCtx === null) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
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
let orders = [];

class Order {
    constructor(type, priceString) {
        if (!DIRECTION_TYPES.includes(type) || priceString === null) {
            throw new TypeError('invalid params');
        }
        this.type = type;
        this.priceString = priceString;
        this.series1PriceLine = null;
        this.series2PriceLine = null;
    }
}

function addOrder(type, priceString) {
    if (priceString === null) {
        return;
    }

    const price = +priceString;
    const priceLineOptions = {
        price: price,
        color: PRICE_LINE_COLOR[type],
        lineStyle: LightweightCharts.LineStyle.Solid,
        draggable: true,
    };
    const order = new Order(type, priceString);
    order.series1PriceLine = candleSeries1.createPriceLine(priceLineOptions);
    order.series2PriceLine = candleSeries2.createPriceLine(priceLineOptions);
    orders.push(order);

    let condition = 'stop';
    if ((type === 'buy' && price < getLastPrice()) ||
        (type === 'sell' && price > getLastPrice())) {
        condition = 'limit';
    }
    showMessage(`<span class="text-capitalize">${type}</span>&nbsp;${condition} order @ ${priceString}`);
    updateOrdersTable();
}

function addMarketOrder(type) {
    const price = getLastPrice();
    const order = new Order(type, price.toString());
    activateOrder(order, price);
    updatePositionsTable();
}

function removeOrder(order) {
    if (order.series1PriceLine !== null) {
        candleSeries1.removePriceLine(order.series1PriceLine);
    }
    if (order.series2PriceLine !== null) {
        candleSeries2.removePriceLine(order.series2PriceLine);
    }
    orders = orders.filter(o => o !== order);
    updateOrdersTable();
}

function removeAllOrders() {
    orders.forEach(order => removeOrder(order));
}

function sortOrders(ascending = true) {
    orders.sort((a, b) => (+a.priceString) - (+b.priceString));
    if (ascending === false) {
        orders.reverse();
    }
}

function checkIfOrderTriggered() {
    if (displayBars.length < 2) {
        return false;
    }
    let hasTriggeredOrder = false;
    const lastBar = displayBars[displayBars.length - 1];
    const secondLastBar = displayBars[displayBars.length - 2];

    // Trigger by gap
    for (const order of orders) {
        const price = +order.priceString;
        if ((secondLastBar.close <= price && price < lastBar.open) ||
            (secondLastBar.close >= price && price > lastBar.open)) {
            activateOrder(order, lastBar.open);
            hasTriggeredOrder = true;
        }
    }

    const bar = lastBar;
    if (bar.open <= bar.close) {
        /*   Simulated order triggering sequence: (1) start from O, (2) down to L, (3) up to H.
         *
         *   H  |             /\
         *      |            /  \
         *   C ---          /    \
         *     | |         /
         *     | |        /
         *     | |       /
         *   O --- \    /
         *      |   \  /
         *   L  |    \/
         *         Time ->
         */
        sortOrders(false);
        for (const order of orders) {
            const price = +order.priceString;
            if (bar.low <= price && price <= bar.open) {
                activateOrder(order, price);
                hasTriggeredOrder = true;
            }
        }
        sortOrders();
        for (const order of orders) {
            const price = +order.priceString;
            if (bar.open < price && price <= bar.high) {
                activateOrder(order, price);
                hasTriggeredOrder = true;
            }
        }
    } else {
        /*   Simulated order triggering sequence: (1) start from O, (2) up to H, (3) down to L.
         *
         *   H  |    /\
         *      |   /  \
         *   O --- /    \
         *     | |       \
         *     | |        \
         *     | |         \
         *   C ---          \    /
         *      |            \  /
         *   L  |             \/
         *         Time ->
         */
        sortOrders();
        for (const order of orders) {
            const price = +order.priceString;
            if (bar.open <= price && price <= bar.high) {
                activateOrder(order, price);
                hasTriggeredOrder = true;
            }
        }
        sortOrders(false);
        for (const order of orders) {
            const price = +order.priceString;
            if (bar.low <= price && price < bar.open) {
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
    // Close the oldest position first
    positions.sort((a, b) => a.id - b.id);
    for (const position of positions) {
        if (position.status === 'running' && isPairingDirections(order, position)) {
            closePosition(position, triggeredPrice);
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
    titleLi.setAttribute('class', 'list-group-item list-group-item-info d-flex');
    titleLi.innerHTML = `
        <span class="mr-3 align-middle"><i class="fa fa-book" aria-hidden="true"></i></span>
        <span class="mr-2 flex-grow-1 text-nowrap">Orders</span>
        <span class="mr-2 text-nowrap">[ Distance ]</span>
        <button type="button" class="close" aria-label="Remove" title="Remove all orders"><span aria-hidden="true">&times;</span></button>
    `;
    titleLi.getElementsByTagName('button')[0].onclick = () => removeAllOrders();
    ul.appendChild(titleLi);

    if (orders.length === 0) {
        ul.appendChild(createEmptyLi());
    } else {
        const lastPrice = getLastPrice();
        const tickerInfo = getTickerInfo();
        sortOrders(false);

        for (const order of orders) {
            const li = document.createElement('li');
            li.setAttribute('class', 'list-group-item d-flex');
            if (order.type === 'buy') {
                li.classList.add('list-group-item-success');
            } else {
                li.classList.add('list-group-item-danger');
            }
            const orderPrice = +order.priceString;
            let distanceTicks = Math.floor((lastPrice - orderPrice) / tickerInfo.minMove);
            const arrow = distanceTicks > 0 ? '➘' : distanceTicks < 0 ? '➚' : '➙';
            distanceTicks = Math.abs(distanceTicks);
            const distanceDollars = convertDollarsToString(distanceTicks * tickerInfo.tickValue);

            li.innerHTML = `
                <span class="mr-2 flex-grow-1 text-capitalize text-nowrap">${order.type} @ ${order.priceString}</span>
                <span class="mr-2 text-nowrap">[ ${arrow} ${distanceTicks} ticks / $${distanceDollars} ]</span>
                <button type="button" class="close" aria-label="Remove" title="Remove order"><span aria-hidden="true">&times;</span></button>
            `;
            li.getElementsByTagName('button')[0].onclick = () => removeOrder(order);
            ul.appendChild(li);
        }
    }
}


function convertPriceToString(price, precision) {
    precision = precision || getTickerInfo().precision;
    return price.toFixed(precision);
}

function convertDollarsToString(dollars, precision) {
    precision = precision || getTickerInfo().tickValuePrecision;
    if (dollars >= 0) {
        return dollars.toFixed(precision);
    }
    return `(${Math.abs(dollars).toFixed(precision)})`;
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
        this.openedTime = getCurrentChartTime();
        this.closedPrice = null;
        this.closedTime = null;
        this.id = positionId++;
    }
    setClosedPrice(price) {
        this.closedPrice = price;
        this.closedTime = getCurrentChartTime();
    }
    get status() {
        if (this.closedPrice === null) {
            return 'running';
        }
        return 'closed';
    }
    get direction() {
        return this.type === 'buy' ? 'Long' : 'Short';
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
    toMarkers() {
        const BUY_MARKER = {
            position: 'belowBar',
            shape: 'arrowUp',
            size: 1.5,
            color: PRICE_LINE_COLOR.buy,
        };
        const SELL_MARKER = {
            position: 'aboveBar',
            shape: 'arrowDown',
            size: 1.5,
            color: PRICE_LINE_COLOR.sell,
        };

        const markers = [];
        if (this.type === 'buy') {
            markers.push({
                ...BUY_MARKER,
                price: this.openedPrice,
                time: this.openedTime,
            });
            if (this.closedPrice !== null) {
                markers.push({
                    ...SELL_MARKER,
                    price: this.closedPrice,
                    time: this.closedTime,
                });
            }
        } else {
            markers.push({
                ...SELL_MARKER,
                price: this.openedPrice,
                time: this.openedTime,
            });
            if (this.closedPrice !== null) {
                markers.push({
                    ...BUY_MARKER,
                    price: this.closedPrice,
                    time: this.closedTime,
                });
            }
        }
        return markers;
    }
    toPLString() {
        return `$${convertDollarsToString(this.calculatePL())}`;
    }
    toString() {
        const openedPrice = convertPriceToString(this.openedPrice);
        let closedPrice = '';
        if (this.closedPrice !== null) {
            let arrow = '➙';
            if (this.openedPrice < this.closedPrice) {
                arrow = '➚';
            } else if (this.openedPrice > this.closedPrice) {
                arrow = '➘';
            }
            closedPrice = ` ${arrow} ${convertPriceToString(this.closedPrice)}`;
        }
        return `${this.direction} @ ${openedPrice}${closedPrice}`;
    }
}

function calculatePositionsTotalPL() {
    return positions.map(p => p.calculatePL()).reduce((sum, current) => sum + current, 0);
}

function openPosition(type, openedPrice) {
    const position = new Position(type, openedPrice);
    positions.push(position);
    showMessage(`${position.direction} position opened @ ${openedPrice}`);
}

function closePosition(position, closedPrice) {
    closedPrice = closedPrice || getLastPrice();
    position.setClosedPrice(closedPrice);
    showMessage(`${position.direction} position closed @ ${closedPrice}`);
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
    titleLi.setAttribute('class', 'list-group-item list-group-item-info d-flex');
    let totalPLString = '';
    if (positions.length > 0) {
        const totalPL = calculatePositionsTotalPL();
        totalPLString = `: $${convertDollarsToString(totalPL)}`;
    }
    titleLi.innerHTML = `
        <span class="mr-3 align-middle"><i class="fa fa-rocket" aria-hidden="true"></i></span>
        <span class="mr-2 flex-grow-1 text-nowrap">Positions</span>
        <span class="mr-2 text-nowrap">[ P/L${totalPLString} ]</span>
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
                class_ = position.calculatePL() >= 0 ? 'list-group-item-success' : 'list-group-item-danger';
            }

            const li = document.createElement('li');
            li.setAttribute('class', 'list-group-item d-flex');
            li.classList.add(class_);
            li.innerHTML = `
                <span class="mr-2 flex-grow-1 text-capitalize text-nowrap">${position}</span>
                <span class="mr-2 text-nowrap">[ ${position.toPLString()} ]</span>
                <button type="button" class="close" aria-label="${title}" title="${title} position"><span aria-hidden="true">&times;</span></button>
            `;
            li.getElementsByTagName('button')[0].onclick = () => fn(position);
            ul.appendChild(li);
        }
    }

    updatePositionsMarkers();
}

chart1.positionLines = [];
chart2.positionLines = [];

function addPositionLines(position, markers) {
    const lineOptions = {
        priceLineVisible: false,
        lastValueVisible: false,
        baseLineVisible: false,
        color: PRICE_LINE_COLOR[position.type],
        lineWidth: 2,
    };
    const data = [
        { time: markers[0].time, value: markers[0].price },
        { time: markers[1].time, value: markers[1].price },
    ];

    if (data[0].time !== data[1].time) {
        const lineSeries2 = chart2.addLineSeries(lineOptions);
        lineSeries2.setData(data);
        lineSeries2.positionId = position.id;
        chart2.positionLines.push(lineSeries2);
    }

    data.forEach(d => d.time -= d.time % 3600);
    if (data[0].time !== data[1].time) {
        const lineSeries1 = chart1.addLineSeries(lineOptions);
        lineSeries1.setData(data);
        lineSeries1.positionId = position.id;
        chart1.positionLines.push(lineSeries1);
    }
}

function trimPositionLines() {
    const existingPositionIds = positions.map(position => position.id);
    for (const line2 of chart2.positionLines) {
        if (existingPositionIds.includes(line2.positionId)) {
            continue;
        }
        chart2.removeSeries(line2);
        for (const line1 of chart1.positionLines) {
            if (line1.positionId === line2.positionId) {
                chart1.removeSeries(line1);
                chart1.positionLines = chart1.positionLines.filter(line => line !== line1);
                break;
            }
        }
    }
    chart2.positionLines = chart2.positionLines.filter(
        line => existingPositionIds.includes(line.positionId)
    );
}

function updatePositionsMarkers() {
    const allMarkers = [];
    const existingPositionLineIds = chart2.positionLines.map(line => line.positionId);

    for (const position of positions) {
        const markers = position.toMarkers();
        allMarkers.push(...markers);
        if (markers.length === 2 &&
            !existingPositionLineIds.includes(position.id)) {
            addPositionLines(position, markers);
        }
    }
    trimPositionLines();

    allMarkers.sort((a, b) => a.time - b.time);
    candleSeries2.setMarkers(allMarkers);
    allMarkers.forEach((marker) => marker.time -= marker.time % 3600);
    candleSeries1.setMarkers(allMarkers);
}

let messageQueue = [];
let isShowingMessage = false;

function showMessage(message, timeout = 2000) {
    message = `<div style="vertical-align:middle">${message}</div>`;
    messageQueue.push([message, timeout]);
    consumeMessageQueue();
}

function dedupMessageQueue() {
    const uniqueArray = [];
    for (const [message, timeout] of messageQueue) {
        let found = false;
        if (message.includes('😭')) {
            for (const [m, t] of uniqueArray) {
                if (message === m && timeout === t) {
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            uniqueArray.push([message, timeout]);
        }
    }
    messageQueue = uniqueArray;
}

function consumeMessageQueue() {
    if (isShowingMessage || messageQueue.length === 0) {
        return;
    }
    dedupMessageQueue();

    const [message, timeout] = messageQueue.shift();
    const el = document.getElementById('message');
    el.innerHTML = message;
    isShowingMessage = true;
    setTimeout(() => {
        el.innerText = '';
        setTimeout(() => {
            isShowingMessage = false;
            consumeMessageQueue();
        }, 100);
    }, timeout);
}

function registerChangeTickerHandler() {
    const buttons = document.getElementById('ticker-selector').querySelectorAll('button');
    for (const button of buttons) {
        button.onclick = () => {
            const ticker = button.innerText;
            if (ticker !== getCurrentTicker()) {
                setCurrentTicker(ticker);
                messageQueue = [];
                sendGotoAction(getCurrentChartTime());
            }
        }
    }
}

function updateDatetimepickerCurrentDatetime(timestamp) {
    if (typeof timestamp === 'number') {
        const time = moment.utc(timestamp * 1000);
        $('#datetimepicker1').datetimepicker('date', time.format(DATETIME_FORMAT));
        document.getElementById('day-of-week').innerText = `${time.format('ddd')}`;
    }
}

function updateDatetimepickerRange(ticker) {
    // Reset first, otherwise may get error due to minDate > maxDate
    const veryMinDate = moment.utc(946684800000);
    const veryMaxDate = moment.utc(4102444800000);
    $('#datetimepicker1').datetimepicker('minDate', veryMinDate);
    $('#datetimepicker1').datetimepicker('maxDate', veryMaxDate);

    const minDateTimestamp = convertServerTimestampToClientTimestamp(tickersInfo[ticker].minDate);
    const maxDateTimestamp = convertServerTimestampToClientTimestamp(tickersInfo[ticker].maxDate);
    const minDateString = moment.utc(minDateTimestamp * 1000).format(DATETIME_FORMAT);
    const maxDateString = moment.utc(maxDateTimestamp * 1000).format(DATETIME_FORMAT);
    $('#datetimepicker1').datetimepicker('minDate', minDateString);
    $('#datetimepicker1').datetimepicker('maxDate', maxDateString);
}


let isPrefetching = false;

function initialize() {
    initDatetimepicker();
    registerChangeTickerHandler();
    registerButtonsHandler();
    registerChartsPointerEventHandler();
    registerKeyboardEventHandler();
    registerChartResizersHandler();
    updateAlertsTable();
    updateOrdersTable();
    updatePositionsTable();
}

const socket = (function makeWebSocketConnection() {
    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return new ReconnectingWebSocket(`${wsScheme}://${window.location.host}/socket`);
})();

socket.onopen = function (e) {
    console.log(`[${new Date().toLocaleTimeString('en-GB')}] socket opened, hello`);
    isPrefetching = false;
    showMessage('✔️ Connected to the server');
    if (!$.isEmptyObject(tickersInfo)) {
        return;
    }

    initialize();
    sendInitAction();

    // Show Help dialog if explicitly instructed in URL params
    if ((new URL(window.location.href)).searchParams.has('help')) {
        // Auto redirect to trim the param when closing the dialog
        $('#helpModal').on('hidden.bs.modal', function (e) {
            window.location.replace(window.location.origin + window.location.pathname);
        })
        $('#helpModal').modal('show');
    }
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

function adjustBarsTime(bars) {
    bars.forEach(bar => bar.time = convertServerTimestampToClientTimestamp(bar.time));
}

function handleResponse(response) {
    //console.log(response);
    if (response.hasOwnProperty('error')) {
        showMessage('😭 ' + response.error);
        return;
    }

    switch (response.action) {
        case 'init':
            tickersInfo = response.data;
            setCurrentTicker(configs.ticker);
            const paramTimestamp = (new URL(window.location.href)).searchParams.get('timestamp');
            sendGotoAction(paramTimestamp);
            break;

        case 'goto':
            removeAllAlerts();
            removeAllOrders();
            removeAllPositions();

            fetchedBars = response.data;
            adjustBarsTime(fetchedBars);

            const timestamp = convertServerTimestampToClientTimestamp(response.timestamp);
            let endIndex = fetchedBars.length - 1;
            while (endIndex > 0 && fetchedBars[endIndex].time >= timestamp) {
                --endIndex;
            }
            ++endIndex;
            displayBars = fetchedBars.slice(0, endIndex + 1);

            for (const series of candleSerieses) {
                series.applyOptions({
                    priceFormat: tickersInfo[response.ticker],
                });
            }
            commonUpdate();
            resetChart1TimeScale();

            showMessage(`Jumped to ${convertTimestampToStringInUTC(getCurrentChartTime())}`);
            break;

        case 'prefetch':
            if (response.ticker === getCurrentTicker()) {
                const prefetchedBars = response.data;
                adjustBarsTime(prefetchedBars);
                fetchedBars.push(...prefetchedBars);
            }
            isPrefetching = false;
            break;
    }
}

let hourlyBars = [];

function commonUpdate() {
    hourlyBars = resampleToHourlyBars(displayBars);
    candleSeries1.setData(hourlyBars);
    candleSeries2.setData(displayBars);

    updateSeriesPriceScales(candleSeries1, candleSeries2);
    drawDailyOpenPrice();
    updateMA();
    updateDatetimepickerCurrentDatetime(getCurrentChartTime());
    updateOrdersTable();
    updatePositionsTable();
    updateLinkToCurrentTickerAndTimestamp();
}

function step() {
    const currentTime = getCurrentChartTime();
    const maxDate = convertServerTimestampToClientTimestamp(getTickerInfo().maxDate);
    if (currentTime === maxDate) {
        showMessage('😭 Already reached the end of historial data!');
        return;
    }

    const nextIndex = fetchedBars.map(bar => bar.time).indexOf(currentTime) + 1;
    if (nextIndex < fetchedBars.length) {
        const bar = fetchedBars[nextIndex];
        displayBars.push(bar);
    } else {
        showMessage('😭 Waiting for server response...');
    }

    const PREFETCH_THRESHOLD = 24;
    if (fetchedBars.length - nextIndex < PREFETCH_THRESHOLD) {
        sendPrefetchAction();
    }

    const lastBarTriggeredAlert = checkIfAlertTriggered();
    const lastBarTriggeredOrder = checkIfOrderTriggered();
    const hasTriggeredPriceLine = lastBarTriggeredAlert || lastBarTriggeredOrder;
    commonUpdate();
    return hasTriggeredPriceLine;
}

function stepback() {
    if (displayBars.length <= 1) {
        showMessage('😭 Already reached the first bar!');
        return;
    }
    displayBars.pop();
    commonUpdate();
}

socket.onclose = function (e) {
    console.log(`[${new Date().toLocaleTimeString('en-GB')}] socket closed, bye`);
}

socket.onerror = function (e) {
    console.log(`[${new Date().toLocaleTimeString('en-GB')}] socket error`);
    showMessage('😭 Server seems down! Reconnecting...', 3000);
}

function sendInitAction() {
    socket.send(JSON.stringify({ action: 'init' }));
}

function sendGotoAction(timestamp) {
    socket.send(JSON.stringify({
        action: 'goto',
        ticker: getCurrentTicker(),
        timestamp: (timestamp == null) ? 0 : convertClientTimestampToServerTimestamp(timestamp),
    }));
}

function sendPrefetchAction() {
    if (isPrefetching || fetchedBars.length === 0) {
        return;
    }

    const lastBar = fetchedBars[fetchedBars.length - 1];
    const timestamp = convertClientTimestampToServerTimestamp(lastBar.time);
    if (timestamp === getTickerInfo().maxDate) {
        return;
    }

    isPrefetching = true;
    socket.send(JSON.stringify({
        action: 'prefetch',
        ticker: getCurrentTicker(),
        timestamp: timestamp,
    }));
}

async function startFastForward() {
    // Fast forward until triggered any alert or order, or at most LIMIT_N_BARS,
    // whichever happens first
    const LIMIT_N_BARS = 24;
    for (let i = 0; i < LIMIT_N_BARS; ++i) {
        if (step()) {
            break;
        }
        await sleep(20);
    }
}

function registerButtonsHandler() {
    // Since "Space" is an important hotkey, always blur in order to prevent Space triggering buttons

    document.getElementById('dropdownMenuButton').addEventListener('click', function (e) {
        $(this).trigger('blur');
    });

    document.getElementById('stepback-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        stepback();
    });
    document.getElementById('step-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        step();
    });
    document.getElementById('fast-forward-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        startFastForward();
    });

    const alertPriceInput = $('#alert-price');
    const createAlertConfirmButton = document.getElementById('create-alert-confirm-button');
    alertPriceInput[0].addEventListener('keyup', function (e) {
        createAlertConfirmButton.disabled = !alertPriceInput[0].checkValidity();
    });
    alertPriceInput[0].addEventListener('keydown', function (event) {
        if (event.code === 'Enter' || event.code === 'NumpadEnter') {
            createAlertConfirmButton.click();
        }
    });
    document.getElementById('create-alert-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        if (pointerHoverPriceString === null) {
            const tickerInfo = getTickerInfo();
            alertPriceInput.attr('step', tickerInfo.minMove);
            alertPriceInput.change(function () {
                $(this).val(parseFloat($(this).val()).toFixed(tickerInfo.precision));
                createAlertConfirmButton.disabled = !alertPriceInput[0].checkValidity();
            });
            alertPriceInput.val(getLastPrice());
            $('#createAlertModal').modal();
        } else {
            addAlert(pointerHoverPriceString);
        }
    });
    $('#createAlertModal').on('shown.bs.modal', function (e) {
        $('#create-alert-button').on('focus', function (e) {
            $(this).blur();
        });
        alertPriceInput.focus();
    });

    createAlertConfirmButton.addEventListener('click', function (e) {
        $('#createAlertModal').modal('hide');
        addAlert(alertPriceInput.val().toString());
    });

    document.getElementById('buy-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        if (pointerHoverPriceString === null) {
            addMarketOrder('buy');
        } else {
            addOrder('buy', pointerHoverPriceString);
        }
    });
    document.getElementById('sell-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        if (pointerHoverPriceString === null) {
            addMarketOrder('sell');
        } else {
            addOrder('sell', pointerHoverPriceString);
        }
    });

    const infoPanelCheckbox = document.getElementById('info-panel-checkbox');
    infoPanelCheckbox.addEventListener('click', function (e) {
        $(this).trigger('blur');
    });
    infoPanelCheckbox.addEventListener('change', () => {
        shouldDisplayInfoPanel = infoPanelCheckbox.checked;
    });
    infoPanelCheckbox.checked = shouldDisplayInfoPanel;

    document.getElementById('fit-chart1-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        chart1.priceScale('left').applyOptions({ autoScale: true });
        fullUpdateSeriesPriceScales(candleSeries1, candleSeries2, candleSeries1);
    });
    document.getElementById('fit-chart2-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        chart2.priceScale('right').applyOptions({ autoScale: true });
        fullUpdateSeriesPriceScales(candleSeries1, candleSeries2, candleSeries2);
    });
    document.getElementById('reset-scales-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
        chart1.priceScale('left').applyOptions({ autoScale: true });
        chart2.priceScale('right').applyOptions({ autoScale: true });
        resetAllScales();
    });

    document.getElementById('freeze-status-link-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
    });

    $('#optionsModal').on('shown.bs.modal', function (e) {
        $('#options-button').one('focus', function (e) {
            $(this).blur();
        });
    });
    document.getElementById('options-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
    });
    $('#optionsModal').on('hidden.bs.modal', function (e) {
        updateLinkToCurrentTickerAndTimestamp();
    });

    $('#helpModal').on('shown.bs.modal', function (e) {
        $('#help-button').one('focus', function (e) {
            $(this).blur();
        });
    });
    document.getElementById('help-button').addEventListener('click', function (e) {
        $(this).trigger('blur');
    });
}

function registerKeyboardEventHandler() {
    window.addEventListener('keydown', function (event) {
        if (document.activeElement === document.getElementById('datetimepicker-input') ||
            document.activeElement === document.getElementById('alert-price')) {
            return;
        }
        //console.log(`KeyboardEvent: code='${event.code}'`);
        switch (event.code) {
            case 'Space':
            case 'ArrowRight':
                step();

                // Prevent scrolling page
                if (event.target === document.body) {
                    event.preventDefault();
                }
                break;

            case 'KeyF':
                startFastForward();
                break;

            case 'KeyG':
                if (pointerHoverTimestamp !== null) {
                    sendGotoAction(pointerHoverTimestamp);
                }
                break;

            case 'ArrowLeft':
            case 'KeyZ':
                stepback();
                break;

            case 'KeyA':
                if (event.shiftKey) {
                    $('#create-alert-button').click();
                } else {
                    addAlert(pointerHoverPriceString);
                }
                break;

            case 'KeyB':
                if (event.shiftKey) {
                    addMarketOrder('buy');
                } else {
                    addOrder('buy', pointerHoverPriceString);
                }
                break;

            case 'KeyS':
                if (event.shiftKey) {
                    addMarketOrder('sell');
                } else {
                    addOrder('sell', pointerHoverPriceString);
                }
                break;

            case 'KeyD':
                shouldDisplayInfoPanel = !shouldDisplayInfoPanel;
                document.getElementById('info-panel-checkbox').checked = shouldDisplayInfoPanel;
                updateInfoPanel();
                break;

            case 'KeyQ':
                $('#fit-chart1-button').click();
                break;

            case 'KeyW':
            case 'KeyE':
                $('#fit-chart2-button').click();
                break;

            case 'KeyR':
                $('#reset-scales-button').click();
                break;
        }
    }, true);
}

function initDatetimepicker() {
    $('#datetimepicker1').datetimepicker({
        format: DATETIME_FORMAT,
        dayViewHeaderFormat: 'YYYY-MM',
        stepping: 5,
        sideBySide: (isMobileMode ? false : true),
        useCurrent: true,
    });

    const datetimepickerInput = document.getElementById('datetimepicker-input');
    datetimepickerInput.addEventListener('blur', (event) => {
        const inputTimestamp = moment.utc(event.target.value, DATETIME_FORMAT).unix();
        if (inputTimestamp !== getCurrentChartTime()) {
            sendGotoAction(inputTimestamp);
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
    if (audioCtx !== null) {
        audioCtx.close();
    }
};
