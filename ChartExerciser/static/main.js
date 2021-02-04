const TICKER_PRICE_FORMAT = {
    MES: {
        precision: 2,
        minMove: 0.25,
    },
};

const chartWidth = Math.floor(document.body.clientWidth * 0.9 / 2);

let chartAttributes = {
    width: chartWidth,
    height: 400,
    priceScale: {
        position: 'left',
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
        let bar = {};
        bar.time = hour * 3600;
        bar.open = filteredData[0].open;
        bar.close = filteredData[filteredData.length - 1].close;
        bar.high = d3.max(filteredData, e => e.high);
        bar.low = d3.min(filteredData, e => e.low);
        result.push(bar);
    });
    return result;
};


const socket = new WebSocket(`ws://${window.location.host}/ticker/MES`);

socket.onopen = function (e) {
    socket.send(JSON.stringify({ action: 'init' }));
}

socket.onmessage = function (e) {
    const response = JSON.parse(e.data);
    //console.log(response);
    if (response.hasOwnProperty('data')) {
        const ticker = response['ticker'];
        const data = (response['data']);
        const dataHourly = resampleToHourlyBars(data);
        candleSeries1.setData(dataHourly);
        candleSeries2.setData(data);

        candleSeries1.applyOptions({
            priceFormat: TICKER_PRICE_FORMAT[ticker],
        });
        candleSeries2.applyOptions({
            priceFormat: TICKER_PRICE_FORMAT[ticker],
        });
    }
}

socket.onclose = function (e) {
    console.log('bye');
}

socket.onerror = function (e) {
    console.log('bye');
}
//console.log(socket);
