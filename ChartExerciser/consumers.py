import datetime
import json
from pathlib import Path
import random
from channels.generic.websocket import WebsocketConsumer
import pandas as pd


EPOCH = datetime.datetime.utcfromtimestamp(0)


def resample(df: pd.DataFrame, resampled_timeframe_in_minutes: int) -> pd.DataFrame:
    RESAMPLE_MAP = {
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
    }
    return df.resample(f'{resampled_timeframe_in_minutes}T').agg(RESAMPLE_MAP).dropna()


def get_time_range_of_dataframe(df: pd.DataFrame) -> tuple[datetime.datetime, datetime.datetime]:
    start_time = df.iloc[[0]].index.to_pydatetime()[0]
    end_time = df.iloc[[-1]].index.to_pydatetime()[0]
    return (start_time, end_time)


def load_csv_file_into_dataframe(filepath: Path) -> pd.DataFrame:
    FIELD_NAMES = ('time', 'open', 'high', 'low', 'close', 'volume')
    df = pd.read_csv(filepath, names=FIELD_NAMES)
    df = df.drop('volume', axis=1).set_index('time').apply(pd.to_numeric)
    df.index = pd.to_datetime(df.index)
    df = resample(df, 5)
    return df


def load_all_price_data() -> dict[str, pd.DataFrame]:
    path = Path('static/PriceData')
    price_data = {}
    for file in sorted(path.glob('*.txt')):
        try:
            price_data[file.stem] = load_csv_file_into_dataframe(file)
        except:
            print(f'Failed to load "{file}"...')
        else:
            print(f'Loaded price data "{file}"')
    return price_data


def get_all_tickers() -> list[str]:
    return list(PRICE_DATA.keys())


def load_tickers_info():
    tickers_info = {}
    data = None
    with open('static/PriceData/tickers_info.json') as f:
        data = json.load(f)

    for ticker, info in data.items():
        if ticker in PRICE_DATA:
            df = PRICE_DATA[ticker]
            start_time, end_time = get_time_range_of_dataframe(df)
            start_timestamp = int((start_time - EPOCH).total_seconds())
            end_timestamp = int((end_time - EPOCH).total_seconds())
            info['minDate'] = start_timestamp
            info['maxDate'] = end_timestamp
            tickers_info[ticker] = info
    return tickers_info


PRICE_DATA = load_all_price_data()

TICKERS_INFO = load_tickers_info()


class PriceConsumer(WebsocketConsumer):

    def __init__(self, *args, **kwargs) -> None:
        self.ticker = ''
        self.df = None
        self.now = datetime.datetime.now()
        super().__init__(*args, **kwargs)

    def connect(self) -> None:
        print('-> connect()')
        # print(self.scope)
        self.accept()

    def disconnect(self, close_code) -> None:
        print('bye')

    def set_chart_time(self, time: datetime.datetime) -> bool:
        start_time, end_time = get_time_range_of_dataframe(self.df)
        if start_time <= time <= end_time:
            self.now = time
            return True
        return False

    def set_chart_timestamp(self, timestamp: int) -> bool:
        if isinstance(timestamp, int) and timestamp > 0:
            time = datetime.datetime.utcfromtimestamp(timestamp)
            return self.set_chart_time(time)
        return False

    def get_chart_time(self) -> datetime.datetime:
        return self.now

    def set_ticker(self, ticker: str) -> bool:
        if ticker in PRICE_DATA:
            self.ticker = ticker
            self.df = PRICE_DATA[self.ticker]
            return True
        return False

    def step_chart_time(self) -> datetime.datetime:
        pos = self.df.index.get_loc(self.get_chart_time(), method='backfill')
        if pos + 1 >= len(self.df.index):
            # already last frame
            return self.get_chart_time()

        row = self.df.iloc[[pos + 1]]
        time = row.index.to_pydatetime()[0]
        self.set_chart_time(time)
        return time

    def get_random_time(self, start_time: datetime.datetime, end_time: datetime.datetime) -> datetime.datetime:
        MARGIN = datetime.timedelta(days=1)
        FIVE_MINUTES_IN_SECONDS = 60 * 5
        start_timestamp = (start_time + MARGIN - EPOCH).total_seconds()
        end_timestamp = (end_time - MARGIN - EPOCH).total_seconds()
        timestamp = random.randrange(
            start_timestamp, end_timestamp, FIVE_MINUTES_IN_SECONDS)
        return datetime.datetime.utcfromtimestamp(timestamp)

    def jump_to_random_time(self) -> None:
        start_time, end_time = get_time_range_of_dataframe(self.df)
        random_time = self.get_random_time(start_time, end_time)
        self.set_chart_time(random_time)

    def get_sliced_price_data(self, end_time: datetime.datetime = None, n_bars: int = None) -> pd.DataFrame:
        if end_time is None:
            end_time = self.get_chart_time()

        if n_bars is None:
            # Default return two days' 5-min bars
            n_bars = int(2 * 23 * 60 / 5)

        try:
            end_index = self.df.index.get_loc(end_time, method='backfill') + 1
        except KeyError:
            return []
        start_index = max(0, end_index - n_bars)
        df = self.df[start_index:end_index]

        result = []
        for index, row in df.iterrows():
            frame = {
                'time': int(index.timestamp()),
                'open': row['open'],
                'high': row['high'],
                'low': row['low'],
                'close': row['close'],
            }
            result.append(frame)
        return result

    def generate_response(self, text_data: str) -> dict:
        try:
            message = json.loads(text_data)
            action = message.get('action')
            if not isinstance(action, str):
                raise ValueError
        except:
            return {'error': 'invalid action'}

        response = {
            'action': action,
        }

        if action == 'init':
            response.update({
                'data': TICKERS_INFO,
            })
            return response

        elif action == 'step':
            self.step_chart_time()
            response.update({
                'data': self.get_sliced_price_data(n_bars=1),
            })
            return response

        elif action == 'stepback':
            timestamp = message.get('timestamp')
            if self.set_chart_timestamp(timestamp):
                return response

            response.update({
                'error': 'invalid timestamp',
            })
            return response

        elif action == 'switch':
            ticker = message.get('ticker')
            if self.set_ticker(ticker):
                # check if current time fits into new ticker's range
                start_time, end_time = get_time_range_of_dataframe(self.df)
                if not (start_time <= self.get_chart_time() <= end_time):
                    self.jump_to_random_time()

                response.update({
                    'ticker': self.ticker,
                    'data': self.get_sliced_price_data(),
                })
                return response

            response.update({
                'error': 'unknown ticker',
            })
            return response

        elif action == 'goto':
            timestamp = message.get('timestamp')
            if self.set_chart_timestamp(timestamp):
                response.update({
                    'ticker': self.ticker,
                    'data': self.get_sliced_price_data(),
                })
                return response

            response.update({
                'error': 'invalid timestamp',
            })
            return response

        # Should not fall to here
        response.update({
            'error': 'unknown action',
        })
        return response

    def receive(self, text_data=None, bytes_data=None) -> None:
        print('-> receive()', text_data)
        try:
            response = self.generate_response(text_data)
            self.send(text_data=json.dumps(response))
        except:
            # print('Unexpected error:', sys.exc_info()[0])
            raise
