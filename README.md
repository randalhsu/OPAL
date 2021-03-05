# OPAL: Price Action Learning aids

Traders can practice and refine their price action skills with this web app.

[Deployed site](https://practicepriceaction.herokuapp.com?help=1)

## Features

* Dual time frame charts (H1 and M5) with synced status
* Draws Daily open price
* Historical data bar-by-bar replaying and fast forwarding
  * Implemented with WebSocket and auto prefetch for smoother experience
  * zlib compression for lower bandwidth usage
* Switches between different tickers
* Jumps to a specified time
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

1. Build [lightweight-charts](https://github.com/tradingview/lightweight-charts) with the instructions in [lightweight-charts-patch](https://github.com/randalhsu/OPAL/tree/main/lightweight-charts-patch)
2. Put your historical data into ``static/PriceData`` folder
3. Install Python (tested with v3.9.2) and dependencies: ``pip install -r requirements.txt``
4. ``python manage.py collectstatic``
5. ``python manage.py migrate``
6. ``python manage.py runserver``
7. Browse ``http://127.0.0.1:8000/``

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
