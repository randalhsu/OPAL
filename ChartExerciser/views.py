from django.shortcuts import render
from .consumers import get_all_tickers


def index(request):
    tickers = get_all_tickers()
    return render(request, 'index.html', {'tickers': tickers})
