from __future__ import annotations
import datetime
import json
from pathlib import Path
import random
import sys
import zlib
from channels.generic.websocket import WebsocketConsumer
import pandas as pd


PRICE_DATA_PATH: Path = Path('static/PriceData')

EPOCH: datetime.datetime = datetime.datetime.utcfromtimestamp(0)

PREFETCH_N_BARS: int = 24

COMPRESSION_THRESHOLD_SIZE: int = 512


def resample(df: pd.DataFrame, timeframe: str) -> pd.DataFrame:
    RULE_MAP = {
        'H1': 'H',
        'M5': '5T',
        'M1': '1T',
    }
    RESAMPLE_MAP = {
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
    }
    return df.resample(RULE_MAP[timeframe]).agg(RESAMPLE_MAP).dropna()


def convert_timestamp_to_datetime(timestamp: int) -> datetime.datetime:
    return datetime.datetime.utcfromtimestamp(timestamp)


def convert_datetime_to_timestamp(time: datetime.datetime) -> int:
    return (time - EPOCH).total_seconds()


def get_time_range_of_ticker(ticker: str) -> tuple[datetime.datetime, datetime.datetime]:
    df = get_bars(ticker)
    start_time = df.iloc[[0]].index.to_pydatetime()[0]
    end_time = df.iloc[[-1]].index.to_pydatetime()[0]
    return (start_time, end_time)


def load_csv_file_into_dataframe(filepath: Path) -> pd.DataFrame:
    FIELD_NAMES = ('time', 'open', 'high', 'low', 'close', 'volume')
    df = pd.read_csv(filepath, names=FIELD_NAMES)
    df = df.drop('volume', axis=1).set_index('time').apply(pd.to_numeric)
    df.index = pd.to_datetime(df.index)
    return resample(df, 'M5')


def load_all_price_data() -> dict[str, dict[str, pd.DataFrame]]:
    price_data = {}
    for file in sorted(PRICE_DATA_PATH.glob('*.zip')):
        try:
            price_data[file.stem] = {}
            # Default load price data as M5 timeframe
            # If other timeframes are requested, will calculate on demand in get_bars()
            price_data[file.stem]['M5'] = load_csv_file_into_dataframe(file)
        except:
            print(f'Failed to load "{file}"...')
            raise
        else:
            print(f'Loaded price data "{file}"')
    return price_data


def get_bars(ticker: str, timeframe: str = 'M5') -> pd.DataFrame:
    if timeframe in PRICE_DATA[ticker]:
        return PRICE_DATA[ticker][timeframe]
    else:
        PRICE_DATA[ticker][timeframe] = resample(
            PRICE_DATA[ticker]['M5'], timeframe)
        return PRICE_DATA[ticker][timeframe]


def get_all_tickers() -> list[str]:
    return list(PRICE_DATA.keys())


def load_tickers_info() -> dict[str, dict]:
    tickers_info = {}
    data = None
    with open(PRICE_DATA_PATH / 'tickers_info.json') as f:
        data = json.load(f)

    for ticker, info in data.items():
        if ticker in PRICE_DATA:
            start_time, end_time = get_time_range_of_ticker(ticker)
            start_timestamp = int((start_time - EPOCH).total_seconds())
            end_timestamp = int((end_time - EPOCH).total_seconds())
            info['minDate'] = start_timestamp
            info['maxDate'] = end_timestamp
            tickers_info[ticker] = info
    return tickers_info


PRICE_DATA = load_all_price_data()

TICKERS_INFO = load_tickers_info()


def is_valid_timestamp(ticker: str, timestamp: int) -> bool:
    if isinstance(timestamp, int) and timestamp > 0:
        try:
            time = convert_timestamp_to_datetime(timestamp)
        except (OverflowError, OSError):
            return False
        start_time, end_time = get_time_range_of_ticker(ticker)
        return start_time <= time <= end_time
    return False


def align_time(ticker: str, timeframe: str, time: datetime.datetime) -> datetime.datetime:
    # Return a nearest valid time that has data, at or later than the argument time
    df = get_bars(ticker, timeframe)
    time_index = df.index.get_loc(time, method='backfill')
    return df.iloc[[time_index]].index.to_pydatetime()[0]


def get_random_time(ticker: str) -> datetime.datetime:
    start_time, end_time = get_time_range_of_ticker(ticker)

    MARGIN = datetime.timedelta(days=1)
    if end_time - start_time < 2 * MARGIN:
        MARGIN = datetime.timedelta(days=0)

    M5_IN_SECONDS = 60 * 5
    start_timestamp = (start_time + MARGIN - EPOCH).total_seconds()
    end_timestamp = (end_time - MARGIN - EPOCH).total_seconds()
    timestamp = random.randrange(start_timestamp, end_timestamp, M5_IN_SECONDS)
    return convert_timestamp_to_datetime(timestamp)


def get_sliced_bars_by_indices(df: pd.DataFrame, start_index: int, end_index: int) -> list[dict]:
    bars = []
    for index, row in df[start_index:end_index].iterrows():
        bars.append({
            'time': int(index.timestamp()),
            'open': row['open'],
            'high': row['high'],
            'low': row['low'],
            'close': row['close'],
        })
    return bars


def get_sliced_bars_until(df: pd.DataFrame, end_time: datetime.datetime, prefetch: bool = False) -> list[dict]:
    # Default return two days' 5-min bars
    N_BARS = int(2 * 23 * 60 / 5)

    try:
        end_index = df.index.get_loc(end_time, method='backfill') + 1
    except KeyError:
        return []
    start_index = max(0, end_index - N_BARS)

    if prefetch:
        LAST_INDEX = len(df.index)
        end_index = min(end_index + PREFETCH_N_BARS, LAST_INDEX)

    return get_sliced_bars_by_indices(df, start_index, end_index)


def get_sliced_bars_after(df: pd.DataFrame, start_time: datetime.datetime, n_bars: int) -> list[dict]:
    try:
        start_index = df.index.get_loc(start_time, method='pad') + 1
    except KeyError:
        return []
    end_index = min(start_index + n_bars, len(df.index))

    return get_sliced_bars_by_indices(df, start_index, end_index)


class PriceConsumer(WebsocketConsumer):

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

        ticker = message.get('ticker')
        if ticker in PRICE_DATA:
            response.update({'ticker': ticker})
        else:
            return {'error': 'unknown ticker'}

        # Check if timestamp fits into ticker's data time range
        timestamp = message.get('timestamp')
        if is_valid_timestamp(ticker, timestamp):
            time = convert_timestamp_to_datetime(timestamp)
        else:
            time = get_random_time(ticker)
        time = align_time(ticker, 'M5', time)

        if action == 'goto':
            response.update({
                'timestamp': convert_datetime_to_timestamp(time),
                'data': get_sliced_bars_until(get_bars(ticker), time, prefetch=True),
            })

        elif action == 'prefetch':
            response.update({
                'data': get_sliced_bars_after(get_bars(ticker), time, n_bars=PREFETCH_N_BARS),
            })
        else:
            return {'error': 'unknown action'}

        return response

    def receive(self, text_data=None, bytes_data=None) -> None:
        # print('-> receive()', text_data)
        try:
            response = self.generate_response(text_data)
            json_string = json.dumps(response, separators=(',', ':'))

            if sys.getsizeof(json_string) > COMPRESSION_THRESHOLD_SIZE:
                compressed_data = zlib.compress(json_string.encode('utf-8'))
                # print('json:', sys.getsizeof(json_string), ' / zlib:', sys.getsizeof(compressed_data))
                self.send(bytes_data=compressed_data)
            else:
                self.send(text_data=json_string)
        except:
            print('Unexpected error:', sys.exc_info()[0])
            # raise
