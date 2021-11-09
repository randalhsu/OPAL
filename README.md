# OPAL: Price Action Learning aids

Traders can practice and refine their price action skills with this Django web app.

Deployed site: [Desktop layout](https://practicepriceaction.herokuapp.com?help=1) / [mobile layout](https://practicepriceaction.herokuapp.com/m)

## Features

* Historical data bar-by-bar replaying and fast forwarding
  * Implemented with WebSocket and auto prefetch mechanism for smoother experience
  * Utilize zlib compression for lower bandwidth usage
* Dual time frame charts (H1 and M5) with synced status
* Draw Daily open price (as an important potential support/resistance)
* Select between different tickers
* Jump to a specified time
* Alerts
* Buy/Sell orders
* Positions calculation
* Customizable chart options (timezone, colors, etc.)

## Hotkeys

* `Space`/`→`: Step one bar
* `F`: Fast forward 24 bars, or until triggers an alert/order
* `Z`/`←`: Stepback one bar
* Hover over the charts:
  * `A`: Alert
  * `B`: Buy order
  * `S`: Sell order
  * `D`: Toggle price panel

## How to deploy locally

1. Build [lightweight-charts](https://github.com/tradingview/lightweight-charts) with the instructions in [`lightweight-charts-patch`](https://github.com/randalhsu/OPAL/tree/main/lightweight-charts-patch) folder
2. Put your historical data into [`static/PriceData`](https://github.com/randalhsu/OPAL/tree/main/static/PriceData) folder
3. Install Python (tested with v3.9.2) and dependencies: `pip install -r requirements.txt`
4. `python manage.py migrate`
5. `python manage.py runserver`
6. Browse `http://127.0.0.1:8000/`

## How to deploy to Heroku

Follow the above steps 1 and 2, then:

```
heroku login
heroku create {my_app_name}
heroku git:remote -a {my_app_name}
heroku config:set SECRET_KEY="my_Pr3c10uSSSsss"
heroku config:set DEBUG=0
git push heroku main
heroku run python manage.py migrate
heroku ps:scale web=1:free
```

## Developer's Note

Backend main logic:
* [`ChartExerciser/consumers.py`](https://github.com/randalhsu/OPAL/blob/main/ChartExerciser/consumers.py)

Frontend main logic:
* [`ChartExerciser/templates/index.html`](https://github.com/randalhsu/OPAL/blob/main/ChartExerciser/templates/index.html)
* [`ChartExerciser/static/main.js`](https://github.com/randalhsu/OPAL/blob/main/ChartExerciser/static/main.js)
