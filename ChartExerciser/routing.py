from django.urls import re_path

from . import consumers


websocket_urlpatterns = [
    re_path(r'ticker/(?P<ticker>\w+)$',
            consumers.PriceConsumer.as_asgi()),
]
