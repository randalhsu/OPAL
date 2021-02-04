import datetime
import json
from pathlib import Path
from channels.generic.websocket import WebsocketConsumer
import pandas as pd


def resample(df: pd.DataFrame, resampled_timeframe_in_minutes: int = 5) -> pd.DataFrame:
    RESAMPLE_MAP = {
        'open': 'first',
        'high': 'max',
        'low': 'min',
        'close': 'last',
    }
    return df.resample(f'{resampled_timeframe_in_minutes}T').agg(RESAMPLE_MAP).dropna()


def load_csv_file(filepath: Path) -> pd.DataFrame:
    df = pd.read_csv(filepath, names=[
                     'time', 'open', 'high', 'low', 'close', 'volume'])
    df = df.drop('volume', axis=1).set_index('time').apply(pd.to_numeric)
    df.index = pd.to_datetime(df.index)
    df = resample(df)
    return df


def load_all_price_data() -> dict[str, pd.DataFrame]:
    path = Path('static/PriceData')
    price_data = {}
    for file in path.glob('*.txt'):
        try:
            price_data[file.stem] = load_csv_file(file)
        except:
            print(f'Failed to load "{file}"...')
        else:
            print(f'Loaded price data "{file}"')
    return price_data


PRICE_DATA = load_all_price_data()


class PriceConsumer(WebsocketConsumer):

    def __init__(self, *args, **kwargs) -> None:
        self.ticker = ''
        self.df = None
        self.now = None
        super().__init__(*args, **kwargs)

    def set_ticker(self, ticker: str) -> bool:
        if ticker in PRICE_DATA:
            self.ticker = ticker
            self.df = PRICE_DATA[self.ticker]
            return True
        return False

    def set_chart_time(self, timestamp: datetime.datetime) -> None:
        self.now = timestamp

    def step_chart_time(self) -> datetime.datetime:
        pos = self.df.index.get_loc(self.now, method='nearest')
        if pos + 1 >= len(self.df.index):
            # already last frame
            return self.now
        row = self.df.iloc[[pos + 1]]
        timestamp = row.index.to_pydatetime()[0]
        self.set_chart_time(timestamp)
        return timestamp

    def connect(self) -> None:
        print('-> connect()')
        # print(self.scope)
        ticker = ''
        try:
            ticker = self.scope['url_route']['kwargs']['ticker']
        except:
            pass

        if self.set_ticker(ticker):
            timestamp = datetime.datetime.fromisoformat('2020-01-13 16:00:00')
            self.set_chart_time(timestamp)
            self.accept()
        else:
            self.close()

    def disconnect(self, close_code) -> None:
        print('bye')

    def sliced_price_data(self, end_timestamp: datetime.datetime = None, n_bars: int = 1) -> pd.DataFrame:
        if end_timestamp is None:
            end_timestamp = self.now

        end_index = self.df.index.get_loc(end_timestamp, method='nearest') + 1
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

    def generate_response(self, text_data: str) -> str:
        message = json.loads(text_data)
        action = message['action']
        print('action:', action)
        if action == 'init':
            n_bars = int(2 * 23 * 60 / 5)
            response = {
                'ticker': self.ticker,
                'data': self.sliced_price_data(n_bars=n_bars),
            }
            return json.dumps(response)
        elif action == 'step':
            self.step_chart_time()
            response = {
                'ticker': self.ticker,
                'data': self.sliced_price_data(),
            }
            return json.dumps(response)
        return ''

    def receive(self, text_data=None, bytes_data=None) -> None:
        print('-> receive()', text_data)
        try:
            response = self.generate_response(text_data)
            print('response:', response[:100])
            self.send(text_data=response)
        except:
            # print('Unexpected error:', sys.exc_info()[0])
            raise
