# Historical Price Data

Put your data here as `tickername.zip` and add related info into `tickers_info.json`, then it will be loaded by [pandas.read_csv](https://pandas.pydata.org/pandas-docs/stable/reference/api/pandas.read_csv.html) when the server starts.

## Format

CSV fields:

`datetime,open,high,low,close,volume`

where timezone is Eastern Time US.

(Please refer to the example file `MES.zip`)
