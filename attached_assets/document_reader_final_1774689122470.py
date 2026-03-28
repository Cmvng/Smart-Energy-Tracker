#!/usr/bin/env python3
"""
Universal Financial Document Reader
Reads bank statements, receipts, payment docs
Works on: CSV, digital PDF, scanned PDF, images
No external API keys needed - fully self-contained
"""
import sys, json, re, os
from datetime import datetime

# ─────────────────────────────────────────────
# KEYWORD DICTIONARIES
# ─────────────────────────────────────────────
INCOME_KEYWORDS = [
    'inward transfer','inward remittance','incoming transfer',
    'incoming payment','transfer in','trf in','nip in','nip credit',
    'nibss credit','salary','payroll','wages','stipend',
    'deposit','lodgement','lodgment','cash deposit',
    'credit','credited',' cr ','payment received','received from',
    'receipt from','refund','reversal','reversed','cashback',
    'rebate','reimbursement','interest earned','interest credit',
    'dividend','investment return','fd maturity',
    'swift credit','wire transfer in','foreign inward',
    'mpesa credit','moma credit','mtn momo in',
    'upi credit','neft credit','rtgs credit','imps credit',
    'sepa credit','bacs credit','faster payment in',
    'ach credit','direct deposit','inflow','proceeds',
    'freelance','consulting fee','rental income',
    'bonus','commission earned','royalty','scholarship',
    'loan disbursement','loan credit','overdraft credit',
    'funds received','alert: credit','you have received',
]

EXPENSE_KEYWORDS = [
    'outward transfer','outward remittance','outgoing transfer',
    'transfer out','trf out','nip out','nip debit','nibss debit',
    'withdrawal','cash withdrawal','atm withdrawal','atm cash',
    'atm debit','self withdrawal','purchase','pos purchase',
    'pos debit','card purchase','card payment','contactless',
    'web purchase','online purchase','e-commerce',
    'debit','debited',' dr ','direct debit',
    'payment to','paid to','bill payment','utility payment',
    'fee','charge','service charge','maintenance fee',
    'transaction fee','bank charge','commission charge',
    'stamp duty','vat charge','withholding tax','wht',
    'sms alert charge','card maintenance','annual fee',
    'electricity','nepa','phcn','ekedc','ikedc','eedc',
    'water bill','gas bill','internet','broadband',
    'cable tv','dstv','gotv','startimes','airtime','data',
    'insurance premium','rent payment','school fees','tuition',
    'swift debit','wire transfer out','foreign outward',
    'mpesa debit','momo debit','mtn momo out',
    'upi payment','neft debit','rtgs debit',
    'sepa debit','ach debit','ach payment',
    'outflow','loan repayment','emi','mortgage payment',
    'subscription','netflix','spotify',
]

SKIP_KEYWORDS = [
    'opening balance','closing balance','brought forward',
    'carried forward',"b/f","c/f","b/fwd","c/fwd",
    'available balance','ledger balance','current balance',
    'book balance','running balance','account balance',
    'total debit','total credit','total','sub total','subtotal',
    'statement of account','account number','account name',
    'page ','continued on','statement period',
]

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def parse_amount(text):
    if not text: return None, False
    text = str(text).strip()
    if not text or text in ['-','0','']: return None, False
    is_neg = any(x in text.upper() for x in ['DR','(']) or text.startswith('-')
    cleaned = re.sub(r'[₦\$£€₵¥₹\sA-Za-z()DR]', '', text).replace(',', '')
    if not cleaned or cleaned == '.': return None, False
    try:
        v = float(cleaned)
        return (abs(v) if v != 0 else None), is_neg
    except: return None, False

def parse_date(text):
    if not text: return None
    text = str(text).strip()
    months = {'jan':'01','feb':'02','mar':'03','apr':'04','may':'05',
              'jun':'06','jul':'07','aug':'08','sep':'09','oct':'10',
              'nov':'11','dec':'12'}
    patterns = [
        r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})',
        r'(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})',
        r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})',
        r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2})$',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if not m: continue
        try:
            g = m.groups()
            if len(g[0]) == 4: y,mn,d = g[0],g[1].zfill(2),g[2].zfill(2)
            elif g[1].lower()[:3] in months: y,mn,d = g[2],months[g[1].lower()[:3]],g[0].zfill(2)
            else:
                a,b,yr = int(g[0]),int(g[1]),g[2]
                if len(str(yr)) == 2:
                    n = int(yr)
                    yr = str(2000+n) if n < 50 else str(1900+n)
                if a > 12: d,mn = str(a).zfill(2),str(b).zfill(2)
                else: d,mn = str(b).zfill(2),str(a).zfill(2)
                y = yr
            dt = datetime.strptime(f'{y}-{mn}-{d}','%Y-%m-%d')
            if 2000 <= dt.year <= 2030: return dt.strftime('%Y-%m-%d')
        except: continue
    return None

def detect_type(desc, amount, is_neg, dv=None, cv=None):
    d = (desc or '').lower()
    for kw in SKIP_KEYWORDS:
        if kw in d: return None
    if cv and cv > 0 and not dv: return 'income'
    if dv and dv > 0 and not cv: return 'expense'
    for kw in INCOME_KEYWORDS:
        if kw in d: return 'income'
    for kw in EXPENSE_KEYWORDS:
        if kw in d: return 'expense'
    return 'expense' if is_neg else 'income'

def detect_currency(text):
    t = text[:2000]
    scores = {
        'NGN': len(re.findall(r'₦|NGN|\bNaira\b', t, re.I)),
        'GHS': len(re.findall(r'₵|GHc|GHS|\bCedi\b', t, re.I)),
        'KES': len(re.findall(r'KSh|KES|\bShilling\b', t, re.I)),
        'ZAR': len(re.findall(r'ZAR|\bRand\b', t, re.I)),
        'GBP': len(re.findall(r'£|GBP|\bPound\b', t, re.I)),
        'EUR': len(re.findall(r'€|EUR|\bEuro\b', t, re.I)),
        'USD': len(re.findall(r'\$|USD|\bDollar\b', t, re.I)),
        'INR': len(re.findall(r'₹|INR|\bRupee\b', t, re.I)),
        'UGX': len(re.findall(r'USh|UGX', t, re.I)),
        'TZS': len(re.findall(r'TSh|TZS', t, re.I)),
        'XOF': len(re.findall(r'XOF|FCFA', t, re.I)),
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else 'USD'

# ─────────────────────────────────────────────
# CSV READER
# ─────────────────────────────────────────────
def read_csv(filepath):
    import csv, io
    with open(filepath, 'r', encoding='utf-8-sig', errors='ignore') as f:
        content = f.read()
    
    currency = detect_currency(content)
    best_delim = max([',',';','\t','|'], key=lambda d: content[:500].count(d))
    rows = list(csv.reader(io.StringIO(content), delimiter=best_delim))
    if not rows: return [], currency
    
    col_date=col_desc=col_amount=col_debit=col_credit=None
    hi=0
    date_kw = ['date','trans date','value date','transaction date','posting date','entry date']
    desc_kw = ['description','narration','narrative','details','particulars','remarks','memo','beneficiary']
    amount_kw = ['amount','value','transaction amount']
    debit_kw = ['debit','dr','withdrawal','withdrawals','money out','paid out']
    credit_kw = ['credit','deposit','deposits','money in','paid in','lodgement','lodgment']
    
    for ri, row in enumerate(rows[:15]):
        rl = [str(c).lower().strip() for c in row]
        score = sum(1 for cell in rl if any(kw in cell for kw in date_kw+desc_kw+amount_kw+debit_kw+credit_kw))
        if score >= 2:
            hi = ri
            for ci, cell in enumerate(rl):
                if col_date is None and any(kw in cell for kw in date_kw): col_date=ci
                if col_desc is None and any(kw in cell for kw in desc_kw): col_desc=ci
                if col_amount is None and any(kw == cell for kw in amount_kw): col_amount=ci
                if col_debit is None and any(kw in cell for kw in debit_kw) and 'credit' not in cell: col_debit=ci
                if col_credit is None and any(kw in cell for kw in credit_kw) and 'descri' not in cell and 'debit' not in cell: col_credit=ci
            break
    
    if col_date is None: col_date=0
    if col_desc is None: col_desc=1
    if col_amount is None and col_debit is None: col_amount=2
    
    transactions = []
    for row in rows[hi+1:]:
        if not row or len(row) < 2: continue
        gc = lambda i: str(row[i]).strip() if i is not None and i < len(row) else ''
        date = parse_date(gc(col_date))
        if not date: continue
        desc = gc(col_desc)
        if any(k in desc.lower() for k in SKIP_KEYWORDS): continue
        dv=cv=amt=None; is_neg=False
        if col_debit is not None:
            v,_=parse_amount(gc(col_debit))
            if v: dv=v
        if col_credit is not None:
            v,_=parse_amount(gc(col_credit))
            if v: cv=v
        if col_amount is not None:
            v,ng=parse_amount(gc(col_amount))
            if v: amt=v; is_neg=ng
        final = amt or cv or dv
        if not final or final <= 0: continue
        t = detect_type(desc, final, is_neg, dv, cv)
        if t:
            transactions.append({'date':date,'description':desc,'amount':final,
                                 'type':t,'currency':currency,'confidence':'high'})
    return transactions, currency

# ─────────────────────────────────────────────
# PDF READER (pdfplumber - handles tables)
# ─────────────────────────────────────────────
def read_pdf_tables(filepath):
    import pdfplumber
    transactions = []
    full_text = ""
    
    with pdfplumber.open(filepath) as pdf:
        log(f"PDF: {len(pdf.pages)} pages")
        
        for page in pdf.pages:
            raw = page.extract_text() or ''
            full_text += raw + '\n'
            
            for table in (page.extract_tables() or []):
                if not table or len(table) < 2: continue
                
                # Detect columns
                col_date=col_desc=col_debit=col_credit=col_balance=None
                hi=0
                
                for ri, row in enumerate(table[:6]):
                    if not row: continue
                    rl = [str(c or '').lower().strip() for c in row]
                    if any('date' in c for c in rl) or any(
                       k in c for c in rl for k in ['debit','credit','amount','withdrawal','deposit']):
                        hi=ri
                        for ci, cell in enumerate(rl):
                            # Balance first to exclude it
                            if col_balance is None and 'balance' in cell: col_balance=ci
                            elif col_debit is None and any(k in cell for k in 
                                ['debit','dr ','withdrawal']) and 'credit' not in cell: col_debit=ci
                            elif col_credit is None and any(k in cell for k in 
                                ['credit','deposit','lodg']) and 'descri' not in cell and 'debit' not in cell: col_credit=ci
                            if col_date is None and 'date' in cell and 'update' not in cell: col_date=ci
                            if col_desc is None and any(k in cell for k in 
                                ['narr','descri','partic','detail','remark','memo','benef']): col_desc=ci
                        break
                
                if col_date is None: col_date=0
                if col_desc is None:
                    # Use column with longest average text (exclude date, balance)
                    excl = {col_date, col_balance}
                    lens = []
                    for ci in range(len(table[hi] or [])):
                        if ci in excl: lens.append(0); continue
                        vals = [str((table[ri] or [])[ci] if ci<len(table[ri] or []) else '') 
                               for ri in range(hi+1, min(hi+5, len(table)))]
                        lens.append(sum(len(v) for v in vals)/max(len(vals),1))
                    col_desc = lens.index(max(lens)) if lens else 1
                
                for row in table[hi+1:]:
                    if not row: continue
                    cells = [str(c or '').strip() for c in row]
                    gc = lambda i: cells[i] if i is not None and i<len(cells) else ''
                    
                    date = parse_date(gc(col_date))
                    if not date: continue
                    desc = gc(col_desc)
                    if any(k in desc.lower() for k in SKIP_KEYWORDS): continue
                    
                    dv=cv=None; is_neg=False
                    if col_debit is not None and col_debit != col_balance:
                        v,_=parse_amount(gc(col_debit))
                        if v: dv=v
                    if col_credit is not None and col_credit != col_balance:
                        v,_=parse_amount(gc(col_credit))
                        if v: cv=v
                    
                    final = cv or dv
                    if not final or final <= 0: continue
                    
                    t = detect_type(desc, final, is_neg, dv, cv)
                    if t:
                        transactions.append({'date':date,'description':desc,
                                            'amount':final,'type':t,
                                            'currency':'USD','confidence':'high'})
    
    currency = detect_currency(full_text)
    for t in transactions: t['currency'] = currency
    return transactions, currency, len(full_text.strip()) > 100

# ─────────────────────────────────────────────
# OCR READER (Tesseract - for locked/scanned PDFs)
# ─────────────────────────────────────────────
def read_pdf_ocr(filepath):
    import pytesseract
    from pdf2image import convert_from_path
    
    log("Converting PDF to images for OCR...")
    try:
        pages = convert_from_path(filepath, dpi=200, first_page=1, last_page=10)
        log(f"Converted {len(pages)} pages")
    except Exception as e:
        log(f"Conversion failed: {e}")
        return [], 'USD'
    
    all_text = ""
    for i, page in enumerate(pages):
        log(f"OCR page {i+1}/{len(pages)}...")
        text = pytesseract.image_to_string(page, config='--psm 6 --oem 3')
        all_text += text + "\n"
    
    currency = detect_currency(all_text)
    transactions = parse_text_lines(all_text, currency)
    return transactions, currency

def read_image_ocr(filepath):
    import pytesseract
    from PIL import Image
    log("OCR scanning image...")
    img = Image.open(filepath)
    text = pytesseract.image_to_string(img, config='--psm 6 --oem 3')
    currency = detect_currency(text)
    return parse_text_lines(text, currency), currency

def parse_text_lines(text, currency='USD'):
    transactions = []
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        if len(line) < 10: continue
        
        # Find date
        date = None
        for p in [r'\d{1,2}[/\-]\d{1,2}[/\-]\d{4}',
                  r'\d{4}[/\-]\d{1,2}[/\-]\d{1,2}',
                  r'\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}']:
            m = re.search(p, line, re.IGNORECASE)
            if m:
                date = parse_date(m.group())
                if date: break
        
        if not date: continue
        
        # Find amounts (XX.XX format)
        amounts = []
        for a in re.findall(r'[\d,]+\.\d{2}', line):
            v = float(a.replace(',',''))
            if 0.5 < v < 50000000:
                amounts.append(v)
        
        if not amounts: continue
        
        # Build description from non-number, non-date text
        desc = line
        desc = re.sub(r'\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}', '', desc)
        desc = re.sub(r'\d{4}[/\-]\d{1,2}[/\-]\d{1,2}', '', desc)
        desc = re.sub(r'\d{1,2}\s+\w{3}\s+\d{4}', '', desc, flags=re.I)
        desc = re.sub(r'[\d,]+\.\d{2}', '', desc)
        desc = ' '.join(desc.split()).strip() or 'Transaction'
        
        if any(k in desc.lower() for k in SKIP_KEYWORDS): continue
        
        # Use the transaction amount (usually first or second amount, not last=balance)
        # If multiple amounts, skip the last one (likely balance)
        amt = amounts[0] if len(amounts) == 1 else amounts[-2] if len(amounts) >= 2 else amounts[0]
        
        t = detect_type(desc, amt, False)
        if t:
            transactions.append({'date':date,'description':desc,
                                 'amount':amt,'type':t,
                                 'currency':currency,'confidence':'medium'})
    return transactions

def log(msg):
    print(msg, file=sys.stderr)

# ─────────────────────────────────────────────
# MAIN ENTRY
# ─────────────────────────────────────────────
def process(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    transactions = []
    method = 'unknown'
    currency = 'USD'
    
    if ext == '.csv':
        transactions, currency = read_csv(filepath)
        method = 'csv'
    
    elif ext == '.pdf':
        log("Trying table extraction...")
        transactions, currency, has_text = read_pdf_tables(filepath)
        method = 'pdf-table'
        
        if len(transactions) < 3:
            log(f"Table extraction got {len(transactions)}, trying OCR...")
            ocr_txns, ocr_curr = read_pdf_ocr(filepath)
            if len(ocr_txns) > len(transactions):
                transactions = ocr_txns
                currency = ocr_curr
                method = 'pdf-ocr'
    
    elif ext in ['.jpg','.jpeg','.png','.webp','.tiff','.bmp']:
        transactions, currency = read_image_ocr(filepath)
        method = 'image-ocr'
    
    else:
        print(json.dumps({'success':False,'error':f'Unsupported file type: {ext}'}))
        return
    
    # Deduplicate
    seen = set()
    unique = []
    for t in transactions:
        key = f"{t['date']}_{round(t['amount'])}_{t['description'][:15]}"
        if key not in seen:
            seen.add(key)
            unique.append(t)
    
    unique.sort(key=lambda x: x['date'])
    
    print(json.dumps({
        'success': True,
        'method': method,
        'currency': currency,
        'total_found': len(unique),
        'transactions': unique
    }, indent=2))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error':'Usage: python3 document_reader_final.py <filepath>'}))
        sys.exit(1)
    process(sys.argv[1])
