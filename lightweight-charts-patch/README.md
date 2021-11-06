# lightweight-charts patch

Custom patches that enhance [lightweight-charts](https://github.com/tradingview/lightweight-charts/blob/master/BUILDING.md).

Can be `git am *.patch` against lightweight-charts v3.6.1.

## Steps

Apply patches, then:

1. `npm install`
2. `npm run build:prod`
3. Finally, copy `dist/lightweight-charts.standalone.production.js` to [`ChartExerciser/static`](https://github.com/randalhsu/OPAL/tree/main/ChartExerciser/static)

(You can also just download the prebuilt version [here](https://www.dropbox.com/s/umnb8wj3ui3e3j5/lightweight-charts.standalone.production.js?dl=0).)
