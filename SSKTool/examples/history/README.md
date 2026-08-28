# Historical sales exports

Drop one POS "Sales by Product" export per month here (or anywhere) and pass
them all on the command line:

```
python -m ssktool "path/to/*.xls"
```

With **one** month the tool produces a *projection* (average daily sales carried
forward). With **two or more** months it produces a real *forecast*: a
recency-weighted average of daily demand plus a linear trend, and the
per-product `trend_pct_per_month` column becomes meaningful.

Accepted formats:

* the raw `.xls` the POS exports (SpreadsheetML XML), or
* a normalized CSV with a header `code,product,qty,total[,uom]` and optional
  comment lines:

  ```
  # period: 2026-06-01..2026-06-30
  # company: Seoul Stop Kmart
  code,product,qty,total
  686,1.5L Coke,25,2125.00
  ```
