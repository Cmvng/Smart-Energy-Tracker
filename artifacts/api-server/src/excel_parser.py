import sys, json, re, csv, io
from datetime import datetime

def parse_date(s):
    if not s: return None
    s = str(s).strip().split(' ')[0]
    m = re.match(r'^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$', s)
    if m:
        day, month, year_raw = m.groups()
        yr = int(year_raw)
        year = str(2000+yr) if yr<100 and yr<50 else (
               str(1900+yr) if yr<100 else str(yr))
        try:
            dt = datetime.strptime(
                f'{year}-{month.zfill(2)}-{day.zfill(2)}',
                '%Y-%m-%d')
            if 2000 <= dt.year <= 2030:
                return dt.strftime('%Y-%m-%d')
        except: pass
    m = re.match(r'^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$', s)
    if m:
        y, mo, d = m.groups()
        try:
            dt = datetime.strptime(
                f'{y}-{mo.zfill(2)}-{d.zfill(2)}',
                '%Y-%m-%d')
            if 2000 <= dt.year <= 2030:
                return dt.strftime('%Y-%m-%d')
        except: pass
    months_map = {
        'jan':'01','feb':'02','mar':'03','apr':'04',
        'may':'05','jun':'06','jul':'07','aug':'08',
        'sep':'09','oct':'10','nov':'11','dec':'12'
    }
    m = re.search(
        r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|'
        r'Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})',
        s, re.IGNORECASE)
    if m:
        d, mn, y = m.groups()
        mo = months_map[mn.lower()[:3]]
        try:
            dt = datetime.strptime(
                f'{y}-{mo}-{d.zfill(2)}', '%Y-%m-%d')
            if 2000 <= dt.year <= 2030:
                return dt.strftime('%Y-%m-%d')
        except: pass
    return None

def clean_amount(s):
    if not s: return None
    s = re.sub(r'[₦£\$€,\s()A-Za-z]', '', str(s).strip())
    try:
        v = float(s)
        return abs(v) if v != 0 else None
    except: return None

def is_negative(s):
    s = str(s or '').strip()
    return (s.startswith('(') or s.startswith('-') or
            s.upper().endswith('DR'))

INCOME_KW = [
    'credit','inward','received','salary','deposit',
    'lodg','refund','reversal','inflow','transfer in',
    'money in','cr ','nip in','nibss credit',
    'mpesa credit','direct deposit','bacs credit',
]
EXPENSE_KW = [
    'debit','outward','payment','purchase','withdrawal',
    'atm','pos','fee','charge','stamp','bill',
    'subscription','transfer out','money out',' dr ',
    'nip out','airtime','mpesa debit','direct debit',
]
SKIP_KW = [
    'opening balance','closing balance','brought forward',
    'carried forward','total','available balance',
    'ledger balance','b/f','c/f','account balance',
]
FIN_KW = [
    'date','debit','credit','amount','narration',
    'description','withdrawal','deposit','balance',
    'transaction','money in','money out','type',
    'dr','cr','reference','details','particulars',
    'trans date','value date',
]

def detect_type(desc, cat, has_in, has_out, neg):
    if has_in and not has_out: return 'income'
    if has_out and not has_in: return 'expense'
    text = (str(desc)+' '+str(cat)).lower()
    for k in SKIP_KW:
        if k in text: return None
    for k in INCOME_KW:
        if k in text: return 'income'
    for k in EXPENSE_KW:
        if k in text: return 'expense'
    return 'expense' if neg else 'income'

def detect_currency(content):
    scores = {
        'NGN': len(re.findall(r'₦|NGN|naira',content,re.I)),
        'GBP': len(re.findall(r'£|GBP|pound',content,re.I)),
        'USD': len(re.findall(r'\$|USD|dollar',content,re.I)),
        'EUR': len(re.findall(r'€|EUR|euro',content,re.I)),
        'KES': len(re.findall(r'KSh|KES',content,re.I)),
        'GHS': len(re.findall(r'₵|GHS|cedi',content,re.I)),
        'ZAR': len(re.findall(r'ZAR|rand',content,re.I)),
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else 'NGN'

def get_rows_from_csv(content):
    for delimiter in [',','\t',';','|']:
        try:
            reader = csv.reader(
                io.StringIO(content),
                delimiter=delimiter)
            rows = [r for r in reader
                   if any(c.strip() for c in r)]
            if len(rows) > 1 and len(rows[0]) > 1:
                return rows
        except: continue
    return []

def get_rows_from_excel(filepath):
    import openpyxl
    best_rows = None
    best_score = 0
    try:
        wb = openpyxl.load_workbook(
            filepath, read_only=True, data_only=True)
        for sname in wb.sheetnames:
            try:
                ws = wb[sname]
                rows = []
                for row in ws.iter_rows(values_only=True):
                    if any(c for c in row):
                        rows.append([
                            str(c) if c is not None else ''
                            for c in row
                        ])
                if not rows: continue
                score = 0
                for row in rows[:30]:
                    cells = [str(c).lower().strip()
                            for c in row if c]
                    score = max(score, sum(
                        1 for c in cells
                        if any(kw in c for kw in FIN_KW)
                    ))
                if score > best_score:
                    best_score = score
                    best_rows = rows
            except: continue
        wb.close()
    except Exception as e:
        print(f"Excel open error: {e}", file=sys.stderr)
    return best_rows or []

def parse_rows(rows, content=''):
    if not rows: return [], 'NGN'

    currency = detect_currency(
        content or ' '.join(
            str(c) for row in rows[:10]
            for c in row
        )
    )

    # Find header row
    header_idx = 0
    best_score = 0
    for i, row in enumerate(rows[:30]):
        cells = [str(c).lower().strip() for c in row if c]
        score = sum(1 for c in cells
                   if any(kw in c for kw in FIN_KW))
        if score > best_score:
            best_score = score
            header_idx = i

    # Scan data to detect column types
    data_rows = rows[header_idx+1:header_idx+10]
    col_count = max((len(r) for r in rows[:5]), default=0)

    date_cols, amount_cols, text_cols = [], [], []

    for ci in range(col_count):
        date_hits = amt_hits = text_len = total = 0
        for row in data_rows:
            if ci >= len(row): continue
            val = str(row[ci]).strip()
            if not val: continue
            total += 1
            if parse_date(val.split(' ')[0]):
                date_hits += 1
            cleaned = re.sub(r'[₦£\$€,\s()A-Za-z]','',val)
            try:
                n = float(cleaned)
                if 0.01 < abs(n) < 100000000:
                    amt_hits += 1
            except: pass
            text_len += len(val)
        if total == 0: continue
        if date_hits/total >= 0.5: date_cols.append(ci)
        elif amt_hits/total >= 0.5: amount_cols.append(ci)
        elif text_len/total > 5: text_cols.append(ci)

    # Map columns from headers
    headers = [str(c).lower().strip()
               for c in rows[header_idx]]

    colDate=colIn=colOut=colAmt=colDesc=colBal=colType=-1

    for i, h in enumerate(headers):
        if ('balance' in h or h=='bal') and colBal==-1:
            colBal=i
        elif (('money in' in h or h in ['credit','cr',
              'deposit','deposits'] or 'paid in' in h or
              'inflow' in h or 'lodg' in h or
              'cr amount' in h or 'credit amount' in h) and
             'debit' not in h and 'descri' not in h
             and colIn==-1):
            colIn=i
        elif (('money out' in h or h in ['debit','dr',
               'withdrawal','withdrawals'] or
               'paid out' in h or 'outflow' in h or
               'dr amount' in h or 'debit amount' in h)
              and 'credit' not in h and colOut==-1):
            colOut=i
        if ('date' in h or h=='date/time' or
            'trans date' in h or 'value date' in h or
            'posting date' in h) and colDate==-1:
            colDate=i
        if (('descri' in h or 'narrat' in h or
             'partic' in h or 'detail' in h or
             'to / from' in h or 'to/from' in h or
             'remark' in h or 'benefi' in h or
             'merchant' in h or 'memo' in h) and
            colDesc==-1):
            colDesc=i
        if h in ['type','transaction type',
                 'trans type'] and colType==-1:
            colType=i
        if h in ['amount','transaction amount',
                 'value','trans amount'] and colAmt==-1:
            colAmt=i

    # Fill from data-detected columns
    if colDate==-1 and date_cols: colDate=date_cols[0]
    if colDate==-1: colDate=0

    if colIn==-1 and colOut==-1 and colAmt==-1:
        usable=[c for c in amount_cols if c!=colBal]
        if len(usable)>=2: colIn=usable[0]; colOut=usable[1]
        elif len(usable)==1: colAmt=usable[0]

    if colDesc==-1:
        excl={colDate,colIn,colOut,colAmt,colBal,colType}
        for tc in sorted(text_cols, key=lambda c: -sum(
            len(str(r[c])) for r in data_rows
            if c < len(r)
        )):
            if tc not in excl: colDesc=tc; break

    print(f'[Parser] date={colDate} in={colIn} '
          f'out={colOut} amt={colAmt} '
          f'desc={colDesc} type={colType}',
          file=sys.stderr)

    # Parse transactions
    transactions = []
    for row in rows[header_idx+1:]:
        if not any(str(c).strip() for c in row): continue

        def g(idx):
            return (str(row[idx]).strip()
                    if idx>=0 and idx<len(row) else '')

        date_raw = g(colDate).split(' ')[0]
        if not date_raw: continue
        date = parse_date(date_raw)
        if not date: continue

        in_amt = clean_amount(g(colIn)) if colIn>=0 else None
        out_amt = clean_amount(g(colOut)) if colOut>=0 else None

        # Handle type column
        if colType>=0 and not in_amt and not out_amt:
            type_val = g(colType).lower()
            raw_amt = (clean_amount(g(colAmt))
                      if colAmt>=0 else None)
            if raw_amt:
                if any(k in type_val for k in
                       ['credit','inward','received',
                        'deposit','in']):
                    in_amt = raw_amt
                else:
                    out_amt = raw_amt

        # Single amount column
        if colAmt>=0 and not in_amt and not out_amt:
            raw = g(colAmt)
            av = clean_amount(raw)
            if av:
                if is_negative(raw): out_amt=av
                else: in_amt=av

        if not in_amt and not out_amt: continue

        desc = g(colDesc) or g(colType) or 'Transaction'
        if any(k in desc.lower() for k in SKIP_KW):
            continue

        neg = is_negative(
            g(colOut) if colOut>=0 else g(colAmt))
        t = detect_type(desc,'',
                       bool(in_amt and in_amt>0),
                       bool(out_amt and out_amt>0), neg)
        if not t: continue

        amount = in_amt if t=='income' else out_amt
        if not amount or amount<=0: continue

        transactions.append({
            'date': date,
            'description': desc[:80],
            'amount': amount,
            'type': t,
            'currency': currency,
            'confidence': 'high'
        })

    return transactions, currency

def process_file(filepath):
    ext = filepath.lower().split('.')[-1]

    if ext in ['xlsx','xls']:
        rows = get_rows_from_excel(filepath)
        transactions, currency = parse_rows(rows)
    else:
        # CSV or any text file
        with open(filepath, 'r',
                  encoding='utf-8-sig',
                  errors='ignore') as f:
            content = f.read()
        rows = get_rows_from_csv(content)
        transactions, currency = parse_rows(rows, content)

    print(json.dumps({
        'success': True,
        'method': 'universal-parser',
        'currency': currency,
        'total_found': len(transactions),
        'transactions': transactions
    }))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error':'No file provided'}))
        sys.exit(1)
    process_file(sys.argv[1])
