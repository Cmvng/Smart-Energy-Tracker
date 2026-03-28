import { parse as csvParse } from "csv-parse/sync";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  currency: string;
  confidence: "high" | "medium" | "low";
}

export interface ParseResult {
  transactions?: ParsedTransaction[];
  error?: string;
  locked?: boolean;
  pageCount?: number;
  bank?: string;
  detected_currency?: string;
  parse_method?: "csv" | "pdf-table" | "pdf-lines" | "pdf-ocr";
  skipped?: number;
}

// ─── MASTER KEYWORD DICTIONARIES ────────────────────────────────────────────

const INCOME_KEYWORDS = [
  // Transfer in
  "inward transfer","inward remittance","incoming transfer","incoming payment",
  "transfer in","transfer from","funds transfer in","trf in",
  "nip in","neft in","rtgs in","imps in","upi in",
  // Salary & employment
  "salary","salari","payroll","pay credit","wages","stipend","remuneration",
  "employment income","staff salary",
  // Deposits
  "deposit","cash deposit","lodgement","lodgment","cash lodgement",
  "over the counter","otc deposit","branch deposit","counter deposit",
  // Credits
  "credited","account credited","funds credited",
  // Payments received
  "payment received","payment from","received from","receipt from",
  "proceeds","collection",
  // Business income
  "invoice payment","client payment","customer payment","sales proceeds",
  "business income","revenue","contract payment","project payment",
  // Refunds & reversals
  "refund","reversal","reversed","chargeback","cashback","cash back",
  "rebate","reimbursement","reimburse","returned payment","return credit",
  // Investment & interest
  "interest earned","interest credit","interest income","dividend",
  "investment return","bond coupon","fixed deposit maturity","fd maturity",
  "investment proceeds",
  // International
  "swift credit","wire transfer in","international transfer in",
  "foreign inward remittance","foreign transfer","forex credit","domiciliary credit",
  // Freelance/gig
  "freelance","consultation fee","consulting payment","contract fee",
  // Loans
  "loan disbursement","loan credit","loan proceeds","overdraft credit",
  // Alert patterns
  "alert: credit","alert:credit","you have received","funds received",
  // African bank
  "nibss credit","nip credit","interbank transfer credit",
  "mobile money credit","momo credit","mpesa credit","m-pesa in",
  "airtel money credit","mtn momo in",
  // Asian bank
  "upi credit","neft credit","rtgs credit","imps credit",
  "paytm credit","gpay credit",
  // European bank
  "sepa credit","sepa transfer in","bacs credit","faster payment in",
  "chaps credit","standing order credit",
  // US bank
  "ach credit","direct deposit","zelle credit","venmo credit",
  "wire credit","check deposit","cheque deposit",
  // Other income
  "prize","award","bonus","commission earned","royalty",
  "rental income","rent received","subsidy","grant","scholarship",
];

const EXPENSE_KEYWORDS = [
  // Transfer out
  "outward transfer","outward remittance","outgoing transfer","outgoing payment",
  "transfer out","transfer to","funds transfer out","trf out",
  "nip out","neft out","rtgs out","imps out","upi out","upi debit",
  // Withdrawals
  "withdrawal","cash withdrawal","atm withdrawal","atm cash",
  "cash out","atm debit","pos withdrawal","self withdrawal",
  // Purchases
  "purchase","pos purchase","pos debit","card purchase","card payment",
  "contactless","tap to pay","web purchase","online purchase",
  "e-commerce","ecommerce",
  // Debits
  "debited","account debited","funds debited","direct debit",
  // Payments made
  "payment to","paid to","pay to","bill payment","utility payment",
  // Fees & charges
  "service charge","maintenance fee","account fee","transaction fee",
  "processing fee","bank charge","banking fee","commission charge",
  "stamp duty","vat charge","tax deduction","withholding tax","wht",
  "sms alert charge","sms fee","card maintenance","annual fee",
  // Bills
  "electricity","power bill","nepa","phcn","ekedc","ikedc","eedc",
  "water bill","gas bill","internet","broadband","wifi",
  "cable tv","dstv","gotv","startimes","phone bill","airtime","data",
  "insurance premium","premium payment","rent payment","house rent",
  "school fees","tuition",
  // International
  "swift debit","wire transfer out","international transfer out",
  "foreign outward remittance","forex debit","domiciliary debit",
  // African
  "nibss debit","nip debit","interbank transfer debit",
  "mobile money debit","momo debit","mpesa debit","m-pesa out",
  "airtel money debit","mtn momo out","paybill","till number",
  // Asian
  "upi payment","neft debit","rtgs debit","imps debit",
  // European
  "sepa debit","sepa payment","bacs debit","faster payment out",
  "standing order debit",
  // US
  "ach debit","ach payment","check payment","cheque payment",
  "zelle payment","venmo payment",
  // Loans
  "loan repayment","loan deduction","emi","mortgage payment",
  "overdraft debit","loan recovery",
  // Shopping & lifestyle
  "supermarket","grocery","groceries","restaurant","food","dining",
  "fuel","petrol","gas station","transport","uber","bolt","taxify",
  "airline","flight","hotel","subscription","netflix","spotify",
  "amazon","apple","google pay out","donation","charity",
];

// Rows whose description matches these are balance/header lines — skip them
const SKIP_KEYWORDS = [
  "opening balance","closing balance","brought forward","carried forward",
  "b/f","c/f","b/fwd","c/fwd","total debit","total credit",
  "sub total","subtotal","available balance","ledger balance",
  "current balance","book balance","running balance","account balance",
  "statement of account","account number","account name",
  "sort code","bvn","branch","page","continued","statement period",
];

// ─── BANK NAME DETECTION ─────────────────────────────────────────────────────

const BANK_NAMES: Record<string, string[]> = {
  "Guaranty Trust Bank (GTBank)": ["guaranty trust","gtbank","gtb"],
  "Access Bank": ["access bank","access diamond"],
  "United Bank for Africa (UBA)": ["united bank for africa"," uba "],
  "Zenith Bank": ["zenith bank"],
  "First Bank of Nigeria": ["first bank","firstbank"],
  "Stanbic IBTC": ["stanbic ibtc","stanbic"],
  "FCMB": ["first city monument","fcmb"],
  "Fidelity Bank": ["fidelity bank"],
  "Kuda Bank": ["kuda bank","kuda microfinance"],
  "Opay": ["opay","paycom"],
  "Palmpay": ["palmpay"],
  "Equity Bank Kenya": ["equity bank","equity group"],
  "KCB Bank Kenya": ["kenya commercial bank","kcb"],
  "Co-operative Bank Kenya": ["co-operative bank","co-op bank"],
  "M-Pesa (Safaricom)": ["safaricom","m-pesa","mpesa"],
  "GCB Bank Ghana": ["gcb bank","ghana commercial"],
  "Ecobank": ["ecobank"],
  "MTN Mobile Money": ["mtn momo","mobile money"],
  "Standard Bank SA": ["standard bank"],
  "FNB South Africa": ["first national bank"," fnb "],
  "Nedbank": ["nedbank"],
  "Capitec Bank": ["capitec"],
  "Barclays": ["barclays bank","barclays"],
  "HSBC": ["hsbc"],
  "Lloyds Bank": ["lloyds bank"],
  "NatWest": ["natwest","national westminster"],
  "Monzo": ["monzo"],
  "Revolut": ["revolut"],
  "Starling Bank": ["starling bank"],
  "Chase Bank": ["jpmorgan chase","chase bank"],
  "Bank of America": ["bank of america"],
  "Wells Fargo": ["wells fargo"],
  "Citibank": ["citibank","citi bank"],
  "PayPal": ["paypal"],
  "Wise": ["transferwise","wise.com"],
  "Payoneer": ["payoneer"],
};

function detectBank(text: string): string {
  const t = text.toLowerCase();
  for (const [name, kws] of Object.entries(BANK_NAMES)) {
    if (kws.some((k) => t.includes(k))) return name;
  }
  return "Unknown Bank";
}

// ─── CURRENCY AUTO-DETECTION ─────────────────────────────────────────────────

function detectCurrency(text: string): string {
  const counts: Record<string, number> = {
    NGN: (text.match(/₦|NGN/g) || []).length,
    GHS: (text.match(/₵|GHc|GHS/g) || []).length,
    KES: (text.match(/KSh|KES/g) || []).length,
    ZAR: (text.match(/ZAR|\bR\b/g) || []).length,
    GBP: (text.match(/£|GBP/g) || []).length,
    EUR: (text.match(/€|EUR/g) || []).length,
    USD: (text.match(/\$|USD/g) || []).length,
    INR: (text.match(/₹|INR/g) || []).length,
    UGX: (text.match(/USh|UGX/g) || []).length,
    TZS: (text.match(/TSh|TZS/g) || []).length,
    CAD: (text.match(/CAD/g) || []).length,
    AUD: (text.match(/AUD/g) || []).length,
    SGD: (text.match(/SGD/g) || []).length,
    AED: (text.match(/AED/g) || []).length,
    SAR: (text.match(/SAR/g) || []).length,
  };
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return sorted[0][1] > 0 ? sorted[0][0] : "USD";
}

// ─── UNIVERSAL AMOUNT PARSER ─────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  "$": "USD", "£": "GBP", "€": "EUR", "₦": "NGN", "₵": "GHS",
  "₹": "INR", "¥": "JPY", "R": "ZAR", "KSh": "KES", "USh": "UGX",
  "TSh": "TZS", "GHc": "GHS",
};
const CURRENCY_CODES = [
  "NGN","GHS","KES","ZAR","GBP","EUR","USD","INR","UGX","TZS",
  "CAD","AUD","SGD","HKD","JPY","CNY","BRL","MXN","AED","SAR",
  "CHF","SEK","NOK","DKK","PLN","MYR","THB","IDR","PHP","PKR","EGP",
];

function parseAmount(str: string): { value: number; isNegative: boolean; currency: string | null } {
  if (!str || str.trim() === "" || str.trim() === "-" || str.trim() === "0") {
    return { value: 0, isNegative: false, currency: null };
  }

  let s = str.trim();
  let isNegative = false;
  let currency: string | null = null;

  // Detect negative
  if (s.startsWith("-") || s.startsWith("(") || s.endsWith(")") ||
      /\bDR\b/i.test(s) || s.toLowerCase().includes(" dr")) {
    isNegative = true;
  }

  // Extract currency symbol (multi-char first)
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (sym.length > 1 && s.includes(sym)) {
      currency = code;
      s = s.replace(sym, "");
      break;
    }
  }
  if (!currency) {
    for (const [sym, code] of Object.entries(CURRENCY_SYMBOLS)) {
      if (sym.length === 1 && s.includes(sym)) {
        currency = code;
        s = s.replace(sym, "");
        break;
      }
    }
  }
  // Extract 3-letter currency code
  if (!currency) {
    for (const code of CURRENCY_CODES) {
      if (s.includes(code)) {
        currency = code;
        s = s.replace(code, "");
        break;
      }
    }
  }

  // Remove parens, DR/CR labels, spaces
  s = s.replace(/[()]/g, "").replace(/\bDR\b/gi, "").replace(/\bCR\b/gi, "").replace(/\s+/g, "");

  // European format: 1.234,56 → 1234.56
  if (/\d+\.\d{3},\d{2}/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Standard: strip commas
    s = s.replace(/,/g, "");
  }

  const value = Math.abs(parseFloat(s));
  if (isNaN(value) || value === 0) return { value: 0, isNegative: false, currency: null };

  return { value, isNegative, currency };
}

// ─── UNIVERSAL DATE PARSER ────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseDate(str: string): string | null {
  if (!str || str.trim() === "") return null;
  const s = str.trim();

  type Pattern = { regex: RegExp; parse: (m: RegExpMatchArray) => string };

  const patterns: Pattern[] = [
    // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    {
      regex: /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/,
      parse: (m) => `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`,
    },
    // DD MMM YYYY (01 Mar 2026 or 1 March 2026)
    {
      regex: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i,
      parse: (m) => `${m[3]}-${MONTH_MAP[m[2].toLowerCase().slice(0, 3)]}-${m[1].padStart(2, "0")}`,
    },
    // MMM DD YYYY (Mar 01 2026 or March 1, 2026)
    {
      regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{1,2}),?\s+(\d{4})/i,
      parse: (m) => `${m[3]}-${MONTH_MAP[m[1].toLowerCase().slice(0, 3)]}-${m[2].padStart(2, "0")}`,
    },
    // DDMMMYYYY compact (01Mar2026)
    {
      regex: /(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{4})/i,
      parse: (m) => `${m[3]}-${MONTH_MAP[m[2].toLowerCase().slice(0, 3)]}-${m[1]}`,
    },
    // DDMMMYY compact (01Mar26)
    {
      regex: /(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2})$/i,
      parse: (m) => {
        const yr = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
        return `${yr}-${MONTH_MAP[m[2].toLowerCase().slice(0, 3)]}-${m[1]}`;
      },
    },
    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (smart disambiguation)
    {
      regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/,
      parse: (m) => {
        const a = parseInt(m[1]), b = parseInt(m[2]);
        if (a > 12) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; // must be DD/MM
        if (b > 12) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; // must be MM/DD
        return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; // default DD/MM
      },
    },
    // DD/MM/YY
    {
      regex: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/,
      parse: (m) => {
        const yr = parseInt(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`;
        return `${yr}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      },
    },
  ];

  for (const { regex, parse } of patterns) {
    const match = s.match(regex);
    if (match) {
      try {
        const result = parse(match);
        const d = new Date(result);
        if (!isNaN(d.getTime()) && d.getFullYear() >= 1990 && d.getFullYear() <= 2035) {
          return result;
        }
      } catch {}
    }
  }

  return null;
}

// ─── TRANSACTION TYPE DETECTION ───────────────────────────────────────────────

function shouldSkip(desc: string): boolean {
  const d = desc.toLowerCase();
  return SKIP_KEYWORDS.some((k) => d.includes(k));
}

function detectType(
  desc: string,
  isNegative: boolean,
  debitVal: number | null,
  creditVal: number | null,
  hasDebitCol: boolean,
  hasCreditCol: boolean
): { type: "income" | "expense" | null; confidence: "high" | "medium" | "low" } {
  const d = desc.toLowerCase();

  // Method 1: separate debit/credit columns
  if (hasDebitCol && hasCreditCol) {
    if (creditVal && creditVal > 0) return { type: "income", confidence: "high" };
    if (debitVal && debitVal > 0) return { type: "expense", confidence: "high" };
  }

  // Method 2: income keywords
  for (const kw of INCOME_KEYWORDS) {
    if (d.includes(kw)) return { type: "income", confidence: "high" };
  }
  // Also catch bare "credit" and "cr" patterns carefully
  if (/\bcredit\b/i.test(desc) || /\bcr\b/i.test(desc)) {
    return { type: "income", confidence: "high" };
  }

  // Method 3: expense keywords
  for (const kw of EXPENSE_KEYWORDS) {
    if (d.includes(kw)) return { type: "expense", confidence: "high" };
  }
  // Also catch bare "debit" and "dr" patterns carefully
  if (/\bdebit\b/i.test(desc) || /\bdr\b/i.test(desc)) {
    return { type: "expense", confidence: "high" };
  }

  // Method 4: amount sign
  if (isNegative) return { type: "expense", confidence: "medium" };

  // Method 5: default expense
  return { type: "expense", confidence: "low" };
}

// ─── HEADER DETECTION (exact match safeguards) ────────────────────────────────

const EXACT_ONLY_KEYWORDS = new Set(["cr", "dr", "date", "value", "memo"]);

function detectHeader(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toLowerCase();
    if (keywords.some((k) => h === k || (!EXACT_ONLY_KEYWORDS.has(k) && k.length > 3 && h.includes(k)))) return i;
  }
  return -1;
}

// ─── CSV PARSER ───────────────────────────────────────────────────────────────

export async function parseCSV(buffer: Buffer): Promise<ParseResult> {
  try {
    const text = buffer.toString("utf-8");
    const bank = detectBank(text);
    const detected_currency = detectCurrency(text);

    let delimiter = ",";
    const semiCount = (text.match(/;/g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;
    const tabCount = (text.match(/\t/g) || []).length;
    if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
    else if (tabCount > commaCount) delimiter = "\t";

    const rows: string[][] = csvParse(text, {
      delimiter,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    if (rows.length < 2) return { error: "Could not parse CSV. Please check the file format." };

    const headers = rows[0].map((h) => h.toLowerCase().trim());

    const dateIdx = detectHeader(headers, ["date","transaction date","trans date","value date","posting date","txn date","trans. date","valuedate"]);
    const descIdx = detectHeader(headers, ["description","details","narrative","merchant","particulars","transaction details","remarks","memo","reference","narration","beneficiary"]);
    const amtIdx = detectHeader(headers, ["amount","transaction amount","net amount"]);
    const debitIdx = detectHeader(headers, ["debit","dr","withdrawals","debit amount","money out","withdrawal"]);
    const creditIdx = detectHeader(headers, ["credit","cr","deposits","credit amount","money in","deposit"]);
    const typeIdx = detectHeader(headers, ["type","transaction type","txn type","trans type"]);

    if (dateIdx === -1) return { error: "Could not parse CSV. Please check the file format." };

    const hasDebitCol = debitIdx >= 0;
    const hasCreditCol = creditIdx >= 0;

    const transactions: ParsedTransaction[] = [];
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dateRaw = row[dateIdx]?.trim() ?? "";
      const date = parseDate(dateRaw);
      if (!date) { skipped++; continue; }

      const rawDesc = descIdx >= 0 ? (row[descIdx] || "").trim().slice(0, 120) : "Transaction";
      if (shouldSkip(rawDesc)) { skipped++; continue; }

      // Determine amounts
      let debitVal: number | null = null;
      let creditVal: number | null = null;
      let amount = 0;
      let isNegative = false;
      let rowCurrency = detected_currency;

      if (hasDebitCol || hasCreditCol) {
        if (hasDebitCol) {
          const p = parseAmount(row[debitIdx] || "");
          if (p.value > 0) { debitVal = p.value; if (p.currency) rowCurrency = p.currency; }
        }
        if (hasCreditCol) {
          const p = parseAmount(row[creditIdx] || "");
          if (p.value > 0) { creditVal = p.value; if (p.currency) rowCurrency = p.currency; }
        }
        if (creditVal && creditVal > 0) amount = creditVal;
        else if (debitVal && debitVal > 0) amount = debitVal;
      } else if (amtIdx >= 0) {
        const p = parseAmount(row[amtIdx] || "");
        amount = p.value;
        isNegative = p.isNegative;
        if (p.currency) rowCurrency = p.currency;
      }

      if (!amount || amount === 0) { skipped++; continue; }

      // Check explicit type column first
      let type: "income" | "expense" = "expense";
      let confidence: "high" | "medium" | "low" = "medium";

      if (typeIdx >= 0) {
        const rawType = (row[typeIdx] || "").toLowerCase().trim();
        if (rawType.includes("credit") || rawType.includes("cr")) { type = "income"; confidence = "high"; }
        else if (rawType.includes("debit") || rawType.includes("dr")) { type = "expense"; confidence = "high"; }
        else {
          const det = detectType(rawDesc, isNegative, debitVal, creditVal, hasDebitCol, hasCreditCol);
          if (det.type) { type = det.type; confidence = det.confidence; }
        }
      } else {
        const det = detectType(rawDesc, isNegative, debitVal, creditVal, hasDebitCol, hasCreditCol);
        if (det.type) { type = det.type; confidence = det.confidence; }
      }

      transactions.push({
        date,
        description: rawDesc || "Transaction",
        amount,
        type,
        currency: rowCurrency,
        confidence,
      });
    }

    if (transactions.length === 0) return { error: "Could not parse CSV. Please check the file format." };

    return { transactions, bank, detected_currency, parse_method: "csv", skipped };
  } catch (err: any) {
    console.error("[CSV Parser error]", err?.message || err);
    return { error: "Could not parse CSV. Please check the file format." };
  }
}

// ─── OCR VIA pdftoppm + tesseract.js ──────────────────────────────────────────

async function ocrPDF(buffer: Buffer): Promise<string> {
  const { execSync } = await import("child_process");
  const { mkdtempSync, writeFileSync, readdirSync, rmSync } = await import("fs");
  const { join } = await import("path");
  const { tmpdir } = await import("os");

  const tmpDir = mkdtempSync(join(tmpdir(), "ine-ocr-"));
  const pdfPath = join(tmpDir, "input.pdf");
  const outPrefix = join(tmpDir, "page");

  try {
    writeFileSync(pdfPath, buffer);

    // Convert each page to a 200-DPI PNG (uses system pdftoppm / poppler)
    execSync(`pdftoppm -r 200 -png "${pdfPath}" "${outPrefix}"`, { timeout: 60_000 });

    const images = readdirSync(tmpDir)
      .filter((f) => f.endsWith(".png"))
      .sort()
      .map((f) => join(tmpDir, f));

    if (images.length === 0) return "";

    const Tesseract = await import("tesseract.js");
    let allText = "";

    for (const imgPath of images) {
      console.log(`[OCR] Processing page: ${imgPath}`);
      const worker = await Tesseract.createWorker("eng");
      const { data: { text } } = await worker.recognize(imgPath);
      await worker.terminate();
      allText += text + "\n";
    }

    return allText;
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── SHARED TEXT → TRANSACTIONS PARSER ────────────────────────────────────────

function parseLinesIntoTransactions(
  text: string,
  detected_currency: string
): { transactions: ParsedTransaction[]; skipped: number } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const transactions: ParsedTransaction[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  function extractAmounts(line: string): Array<{ value: number; currency: string }> {
    const matches = line.match(/[\d,]+\.?\d{0,2}/g) || [];
    return matches
      .map((m) => parseFloat(m.replace(/,/g, "")))
      .filter((n) => !isNaN(n) && n > 0.01 && n < 100_000_000)
      .map((value) => ({ value, currency: detected_currency }));
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const date = parseDate(line);
    if (!date) continue;
    if (shouldSkip(line)) { skipped++; continue; }

    const ctx = [line, lines[i + 1] || "", lines[i + 2] || ""].join(" ");
    if (shouldSkip(ctx)) { skipped++; continue; }

    const allAmounts = extractAmounts(ctx);
    if (allAmounts.length === 0) continue;

    const { value: amount, currency: rowCurrency } = allAmounts[allAmounts.length - 1];

    const descLine = lines[i + 1] || line;
    const desc = descLine
      .replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, "")
      .replace(/\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}/g, "")
      .replace(/[$£€₦₵₹¥]?[\d,]+\.?\d{0,2}/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);

    const key = `${date}|${amount}|${desc.slice(0, 20)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const det = detectType(ctx, false, null, null, false, false);
    const type = det.type ?? "expense";
    const confidence = det.confidence;

    transactions.push({
      date,
      description: desc || "Transaction",
      amount,
      type,
      currency: rowCurrency || detected_currency,
      confidence,
    });
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));
  return { transactions, skipped };
}

// ─── PDF PARSER ───────────────────────────────────────────────────────────────

export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  try {
    const pdfParse: (buf: Buffer, opts?: any) => Promise<any> = _require("pdf-parse");
    const pdfData = await pdfParse(buffer);
    const textLength = (pdfData.text?.trim() || "").length;
    const pageCount = pdfData.numpages || 1;

    // ── LOCKED / ENCRYPTED PDF → try OCR fallback ──────────────────────────
    if (textLength < 100) {
      console.log(`[parsePDF] Locked PDF detected (textLength=${textLength}, pages=${pageCount}). Attempting OCR…`);
      try {
        const ocrText = await ocrPDF(buffer);
        const ocrLength = ocrText.trim().length;
        console.log(`[parsePDF] OCR extracted ${ocrLength} characters across ${pageCount} page(s)`);

        if (ocrLength < 50) {
          return { locked: true, pageCount, error: "locked_pdf" };
        }

        const bank = detectBank(ocrText);
        const detected_currency = detectCurrency(ocrText);
        const { transactions, skipped } = parseLinesIntoTransactions(ocrText, detected_currency);

        if (transactions.length === 0) {
          return { locked: true, pageCount, error: "locked_pdf" };
        }

        console.log(`[parsePDF] OCR succeeded → ${transactions.length} transactions (${skipped} skipped)`);
        return { transactions, bank, detected_currency, parse_method: "pdf-ocr", skipped };
      } catch (ocrErr: any) {
        console.error("[parsePDF] OCR failed:", ocrErr?.message);
        return { locked: true, pageCount, error: "locked_pdf" };
      }
    }

    // ── NORMAL DIGITAL PDF ──────────────────────────────────────────────────
    console.log(`[parsePDF] Normal PDF (textLength=${textLength}). Using text extraction.`);
    const text = pdfData.text;
    const bank = detectBank(text);
    const detected_currency = detectCurrency(text);
    const { transactions, skipped } = parseLinesIntoTransactions(text, detected_currency);

    if (transactions.length === 0) {
      return { error: "Could not extract transactions from PDF. Try exporting as CSV from your bank instead." };
    }

    console.log(`[parsePDF] Text extraction → ${transactions.length} transactions (${skipped} skipped)`);
    return { transactions, bank, detected_currency, parse_method: "pdf-lines", skipped };
  } catch (err: any) {
    console.error("[parsePDF] Error:", err?.message);
    // If pdf-parse itself threw (e.g. DOMMatrix, encryption error), try OCR as last resort
    try {
      console.log("[parsePDF] pdf-parse threw, attempting OCR fallback...");
      const ocrText = await ocrPDF(buffer);
      if (ocrText.trim().length >= 50) {
        const bank = detectBank(ocrText);
        const detected_currency = detectCurrency(ocrText);
        const { transactions, skipped } = parseLinesIntoTransactions(ocrText, detected_currency);
        if (transactions.length > 0) {
          console.log(`[parsePDF] OCR fallback succeeded → ${transactions.length} transactions`);
          return { transactions, bank, detected_currency, parse_method: "pdf-ocr", skipped };
        }
      }
    } catch (ocrErr: any) {
      console.error("[parsePDF] OCR fallback also failed:", ocrErr?.message);
    }
    return { locked: true, error: "locked_pdf" };
  }
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

export async function detectAndParse(buffer: Buffer, filename: string, mimeType: string): Promise<ParseResult> {
  const lc = filename.toLowerCase();
  if (lc.endsWith(".csv") || mimeType.includes("csv") || mimeType.includes("text/plain")) {
    return parseCSV(buffer);
  } else if (lc.endsWith(".pdf") || mimeType.includes("pdf")) {
    return parsePDF(buffer);
  }
  return { error: "Only PDF and CSV files are supported. Image scanning coming soon!" };
}
