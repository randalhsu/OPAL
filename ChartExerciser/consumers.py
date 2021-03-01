from __future__ import annotations
import datetime
import json
from pathlib import Path
import random
import sys
import zlib
from channels.generic.websocket import WebsocketConsumer
import pandas as pd


EPOCH: datetime.datetime = datetime.datetime.utcfromtimestamp(0)


def resample(df: pd.DataFrame, resampled_timeframe_in_minutes: int) -> pd.DataFrame:
    RESAMPLE_MAP = {
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
    }
    return df.resample(f'{resampled_timeframe_in_minutes}T').agg(RESAMPLE_MAP).dropna()


def convert_timestamp_to_datetime(timestamp: int) -> datetime.datetime:
    return datetime.datetime.utcfromtimestamp(timestamp)


def convert_datetime_to_timestamp(time: datetime.datetime) -> int:
    return (time - EPOCH).total_seconds()


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


def load_tickers_info() -> dict[str, dict]:
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
    COMPRESSION_THRESHOLD_SIZE = 512
    PREFETCH_BARS = 24  # Prefetch two hours' 5-min bars

    def __init__(self, *args, **kwargs) -> None:
        self.ticker = ''
        self.df = None
        self.now = datetime.datetime.now()
        super().__init__(*args, **kwargs)

    def connect(self) -> None:
        # print(self.scope)
        self.accept()

    def disconnect(self, close_code) -> None:
        # print('bye')
        pass

    def is_valid_timestamp(self, timestamp: int) -> bool:
        if isinstance(timestamp, int) and timestamp > 0:
            try:
                time = convert_timestamp_to_datetime(timestamp)
            except (OverflowError, OSError):
                return False
            start_time, end_time = get_time_range_of_dataframe(self.df)
            return start_time <= time <= end_time
        return False

    def align_time(self, time: datetime.datetime) -> datetime.datetime:
        # Returns a valid time that has data
        time_index = self.df.index.get_loc(time, method='backfill')
        return self.df.iloc[[time_index]].index.to_pydatetime()[0]

    def set_ticker(self, ticker: str) -> bool:
        if ticker in PRICE_DATA:
            self.ticker = ticker
            self.df = PRICE_DATA[self.ticker]
            return True
        return False

    def get_random_time(self) -> datetime.datetime:
        start_time, end_time = get_time_range_of_dataframe(self.df)

        MARGIN = datetime.timedelta(days=1)
        if end_time - start_time < 2 * MARGIN:
            MARGIN = datetime.timedelta(days=0)

        FIVE_MINUTES_IN_SECONDS = 60 * 5
        start_timestamp = (start_time + MARGIN - EPOCH).total_seconds()
        end_timestamp = (end_time - MARGIN - EPOCH).total_seconds()
        timestamp = random.randrange(
            start_timestamp, end_timestamp, FIVE_MINUTES_IN_SECONDS)
        return convert_timestamp_to_datetime(timestamp)

    def get_sliced_price_data_after(self, start_time: datetime.datetime, n_bars: int) -> list[dict]:
        try:
            start_index = self.df.index.get_loc(start_time, method='pad') + 1
        except KeyError:
            return []
        end_index = min(start_index + n_bars, len(self.df.index))

        return self.get_sliced_price_data_by_indices(start_index, end_index)

    def get_sliced_price_data_until(self, end_time: datetime.datetime, prefetch: bool = False) -> list[dict]:
        # Default return two days' 5-min bars
        N_BARS = int(2 * 23 * 60 / 5)

        try:
            end_index = self.df.index.get_loc(end_time, method='backfill') + 1
        except KeyError:
            return []
        start_index = max(0, end_index - N_BARS)

        if prefetch:
            LAST_INDEX = len(self.df.index)
            end_index = min(end_index + type(self).PREFETCH_BARS, LAST_INDEX)

        return self.get_sliced_price_data_by_indices(start_index, end_index)

    def get_sliced_price_data_by_indices(self, start_index: int, end_index: int) -> list[dict]:
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

        elif action == 'switch':
            ticker = message.get('ticker')
            if not self.set_ticker(ticker):
                response.update({'error': 'unknown ticker'})
                return response

            timestamp = message.get('timestamp')
            # check if current timestamp fits into new ticker's time range
            if self.is_valid_timestamp(timestamp):
                time = convert_timestamp_to_datetime(timestamp)
            else:
                time = self.get_random_time()

            time = self.align_time(time)

            response.update({
                'ticker': self.ticker,
                'timestamp': convert_datetime_to_timestamp(time),
                'data': self.get_sliced_price_data_until(time, prefetch=True),
            })
            return response

        elif action in ('goto', 'prefetch'):
            timestamp = message.get('timestamp')
            if not self.is_valid_timestamp(timestamp):
                response.update({'error': 'invalid timestamp'})
                return response

            response.update({'ticker': self.ticker})
            time = convert_timestamp_to_datetime(timestamp)

            if action == 'goto':
                time = self.align_time(time)
                response.update({
                    'timestamp': convert_datetime_to_timestamp(time),
                    'data': self.get_sliced_price_data_until(time, prefetch=True),
                })
            elif action == 'prefetch':
                response.update({
                    'data': self.get_sliced_price_data_after(time, n_bars=type(self).PREFETCH_BARS),
                })
            return response

        # Should not fall to here
        response.update({'error': 'unknown action'})
        return response

    def receive(self, text_data=None, bytes_data=None) -> None:
        # print('-> receive()', text_data)
        try:
            response = self.generate_response(text_data)
            json_string = json.dumps(response, separators=(',', ':'))

            if sys.getsizeof(json_string) > type(self).COMPRESSION_THRESHOLD_SIZE:
                compressed_data = zlib.compress(json_string.encode('utf-8'))
                # print('json:', sys.getsizeof(json_string), ' / zlib:', sys.getsizeof(compressed_data))
                self.send(bytes_data=compressed_data)
            else:
                self.send(text_data=json_string)
        except:
            print('Unexpected error:', sys.exc_info()[0])
            # raise
