# OPAL: Price Action Learning aids

Traders can practice and refine their price action skills with this Django web app.

Deployed site: [Desktop layout](https://opal-3ern.onrender.com/?help=1) / [mobile layout](https://opal-3ern.onrender.com/m)

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
  * `G`: Go to hovered time
* Scales:
  * `Q`: Fit to left chart
  * `W`/`E`: Fit to right chart
  * `R`: Reset all scales

## How to deploy locally

1. (Optional) Put your historical data into [`static/PriceData`](https://github.com/randalhsu/OPAL/tree/main/static/PriceData) folder
1. Install Python (tested with v3.11.4) and dependencies: `pip install -r requirements.txt`
1. `python manage.py migrate`
1. `python manage.py runserver`
1. Browse `http://127.0.0.1:8000/`

## How to deploy to `render.com`

1. Create a Web Service with this repo
1. Set Start Command as: `daphne mysite.asgi:application --port $PORT --bind 0.0.0.0 -v2`
1. Add Environment Variables:
   * `PYTHON_VERSION`: `3.11.4`
   * `ALLOWED_HOSTS`: (deployed service url, e.g. `xxxx-xxxx.onrender.com`)
   * `SECRET_KEY`: `my_Pr3c10uSSSsss`
   * `DEBUG`: `0`
1. Manual Deploy -> Clear build cache & deploy

## Developer's Note

Backend main logic:
* [`ChartExerciser/consumers.py`](https://github.com/randalhsu/OPAL/blob/main/ChartExerciser/consumers.py)

Frontend main logic:
* [`ChartExerciser/templates/index.html`](https://github.com/randalhsu/OPAL/blob/main/ChartExerciser/templates/index.html)
* [`ChartExerciser/static/main.js`](https://github.com/randalhsu/OPAL/blob/main/ChartExerciser/static/main.js)

