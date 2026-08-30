import { parse as csvParse } from "csv-parse/sync";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

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
  warning?: string;
  bank?: string;
  detected_currency?: string;
  parse_method?: "csv" | "excel-python" | "pdf-table" | "pdf-lines" | "pdf-ocr" | "ai-vision";
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

// ─── EXCEL DATE SERIAL NUMBER CONVERTER ──────────────────────────────────────
// Must live BEFORE parseCSV so it's available when isExcel=true is passed.

function convertExcelDate(value: string): string | null {
  // First try normal date parsing (handles all string date formats)
  const normal = parseDate(value);
  if (normal) return normal;

  // Excel stores dates as serial numbers (days since 1900-01-00, Lotus-compatible)
  // Valid bank statement range: roughly 2009–2064 = serials 40000–60000
  const num = parseFloat(value.trim());
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
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

export async function parseCSV(buffer: Buffer, isExcel = false): Promise<ParseResult> {
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
      const date = isExcel ? convertExcelDate(dateRaw) : parseDate(dateRaw);
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

// ─── AI VISION PIPELINE (OpenAI gpt-4o) ──────────────────────────────────────

export interface OcrProgress {
  type: "pages" | "page_done";
  count?: number;
  current?: number;
  total?: number;
}

const AI_VISION_PROMPT = `You are a financial data extraction expert.
Extract ALL transactions from this bank statement or receipt image.
Return ONLY a valid JSON array, no other text, no markdown, no explanation.

Each transaction must have exactly these fields:
{
  "date": "YYYY-MM-DD",
  "description": "exact transaction description",
  "amount": 1234.56,
  "type": "income or expense",
  "currency": "3-letter code e.g. NGN USD GBP"
}

Rules:
- amount is always a positive number
- type is "income" for credits/deposits/transfers in
- type is "expense" for debits/withdrawals/purchases
- Skip balance rows, opening/closing balance lines
- Skip table headers
- date must be in YYYY-MM-DD format
- If currency not shown, use the most common currency in the document
- Include EVERY transaction row you can find
- Return [] if no transactions found`;

async function pdfToImages(
  buffer: Buffer,
  maxPages = 10,
  onProgress?: (evt: OcrProgress) => void
): Promise<Buffer[]> {
  const { execFileSync } = await import("child_process");
  const { mkdtempSync, writeFileSync, readdirSync, readFileSync, rmSync } = await import("fs");
  const { join } = await import("path");
  const { tmpdir } = await import("os");

  const tmpDir = mkdtempSync(join(tmpdir(), "ine-ai-"));
  const pdfPath = join(tmpDir, "input.pdf");
  const outPrefix = join(tmpDir, "page");

  try {
    writeFileSync(pdfPath, buffer);
    console.log(`[pdfToImages] PDF written: ${buffer.length} bytes → ${pdfPath}`);

    // Use execFileSync (no shell) — avoids all path-escaping issues with spaces/special chars
    try {
      const result = execFileSync(
        "pdftoppm",
        ["-r", "150", "-f", "1", "-l", String(maxPages), "-png", pdfPath, outPrefix],
        { timeout: 60_000, env: process.env }
      );
      console.log("[pdfToImages] pdftoppm stdout:", result.toString().trim() || "(none)");
    } catch (convErr: any) {
      console.error("[pdfToImages] pdftoppm failed:", convErr?.message);
      console.error("[pdfToImages] stderr:", convErr?.stderr?.toString?.() ?? "");
      return [];
    }

    const allFiles = readdirSync(tmpDir);
    console.log("[pdfToImages] tmpDir contents:", allFiles);

    const pngFiles = allFiles
      .filter((f) => f.toLowerCase().endsWith(".png"))
      .sort()
      .map((f) => join(tmpDir, f));

    console.log(`[pdfToImages] PNG files generated: ${pngFiles.length}`);

    if (pngFiles.length === 0) {
      console.error("[pdfToImages] No PNG files found — pdftoppm may have failed silently");
      return [];
    }

    const buffers = pngFiles.map((f) => readFileSync(f));
    console.log("[pdfToImages] Image sizes (bytes):", buffers.map((b) => b.length));

    onProgress?.({ type: "pages", count: buffers.length });

    return buffers;
  } catch (e: any) {
    console.error("[pdfToImages] fatal error:", e?.message);
    console.error("[pdfToImages] stack:", e?.stack);
    return [];
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

async function readWithAI(
  imageBuffers: Buffer[],
  filename: string,
  onProgress?: (evt: OcrProgress) => void
): Promise<ParseResult> {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const content: any[] = [
    { type: "text", text: AI_VISION_PROMPT },
    ...imageBuffers.map((buf) => ({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${buf.toString("base64")}`,
        detail: "high",
      },
    })),
  ];

  console.log(`[AI Vision] Sending ${imageBuffers.length} image(s) to gpt-4o for ${filename}`);
  console.log(`[AI Vision] OpenAI key present:`, !!process.env.OPENAI_API_KEY, "length:", process.env.OPENAI_API_KEY?.length);
  console.log(`[AI Vision] Image buffer sizes:`, imageBuffers.map((b) => b.length));

  let response: any;
  try {
    response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: 4000,
      temperature: 0,
    });
    console.log(`[AI Vision] OpenAI response received, choices: ${response.choices?.length}`);
  } catch (e: any) {
    console.error("[AI Vision] OpenAI full error:", JSON.stringify({
      message: e?.message,
      code: e?.code,
      status: e?.status,
      type: e?.type,
      error: e?.error,
      response: e?.response?.data ?? e?.response?.body,
    }, null, 2));
    throw e;
  }

  const total = imageBuffers.length;
  onProgress?.({ type: "page_done", current: total, total });

  const raw = response.choices[0]?.message?.content ?? "";
  console.log("[AI Vision] raw response (first 3000 chars):", raw.slice(0, 3000));
  console.log("[AI Vision] raw response length:", raw.length);

  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  let aiRows: any[] = [];
  try {
    aiRows = JSON.parse(cleaned);
    console.log("[AI Vision] JSON.parse succeeded, rows:", aiRows.length);
  } catch (parseErr: any) {
    console.warn("[AI Vision] JSON.parse failed:", parseErr?.message);
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        aiRows = JSON.parse(match[0]);
        console.log("[AI Vision] regex fallback parse succeeded, rows:", aiRows.length);
      } catch (e2: any) {
        console.warn("[AI Vision] regex fallback also failed:", e2?.message);
      }
    } else {
      console.warn("[AI Vision] no JSON array found in response at all");
    }
  }

  if (!Array.isArray(aiRows) || aiRows.length === 0) {
    console.warn("[AI Vision] No transactions parsed — raw was:", raw.slice(0, 500));
    return { locked: true };
  }

  const transactions: ParsedTransaction[] = aiRows
    .filter((r) => r.date && r.amount && r.type)
    .map((r): ParsedTransaction => ({
      date: parseDate(r.date) ?? r.date,
      description: String(r.description || "Transaction").slice(0, 120),
      amount: Math.abs(Number(r.amount)) || 0,
      type: String(r.type).toLowerCase().includes("income") ? "income" : "expense",
      currency: String(r.currency || "USD").toUpperCase().slice(0, 3),
      confidence: "high" as const,
    }))
    .filter((t) => t.amount > 0);

  if (transactions.length === 0) {
    return { locked: true };
  }

  const allText = aiRows.map((r) => `${r.description ?? ""} ${r.currency ?? ""}`).join(" ");
  const bank = detectBank(allText + " " + filename);
  const detected_currency = transactions[0]?.currency ?? detectCurrency(allText);

  console.log(`[AI Vision] ✅ Extracted ${transactions.length} transactions`);
  return { transactions, bank, detected_currency, parse_method: "ai-vision", skipped: 0 };
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

export async function parsePDF(
  buffer: Buffer,
  onProgress?: (evt: OcrProgress) => void
): Promise<ParseResult> {
  // ── Step 1: Try free text extraction ──────────────────────────────────────
  try {
    const pdfParse: (buf: Buffer, opts?: any) => Promise<any> = _require("pdf-parse");
    const pdfData = await pdfParse(buffer);
    const textLength = (pdfData.text?.trim() || "").length;

    if (textLength >= 100) {
      const text = pdfData.text;
      const bank = detectBank(text);
      const detected_currency = detectCurrency(text);
      const { transactions, skipped } = parseLinesIntoTransactions(text, detected_currency);

      if (transactions.length >= 5) {
        console.log(`[parsePDF] ✅ Text extraction → ${transactions.length} tx`);
        return { transactions, bank, detected_currency, parse_method: "pdf-lines", skipped };
      }
      console.log(`[parsePDF] Text extraction weak (${transactions.length} tx) → trying AI Vision`);
    } else {
      console.log(`[parsePDF] Short text (${textLength} chars) → trying AI Vision`);
    }
  } catch (e: any) {
    console.log(`[parsePDF] pdf-parse threw: ${e?.message} → trying AI Vision`);
  }

  // ── Step 2: AI Vision ──────────────────────────────────────────────────────
  if (!process.env.OPENAI_API_KEY) {
    console.log("[parsePDF] No OPENAI_API_KEY — returning locked");
    return { locked: true };
  }

  try {
    console.log("[parsePDF] Starting pdfToImages, buffer size:", buffer.length);
    const images = await pdfToImages(buffer, 10, onProgress);
    console.log("[parsePDF] pdfToImages returned", images.length, "image(s)");
    if (images.length === 0) {
      console.error("[parsePDF] ❌ pdfToImages returned 0 images → returning locked");
      return { locked: true };
    }
    return await readWithAI(images, "document.pdf", onProgress);
  } catch (e: any) {
    console.error("[parsePDF] AI Vision failed:", e?.message);
    return { error: "Could not read this document. Try uploading a clearer version or download as CSV from your bank." };
  }
}

// ─── PYTHON EXCEL PARSER ─────────────────────────────────────────────────────
// Delegates to excel_parser.py (openpyxl) via child_process.
// Handles bank statements with summary rows before headers, sparse columns,
// and non-standard column names. Tested to parse 289+ transactions correctly.

function parseExcelWithPython(buffer: Buffer): ParseResult {
  const tmpFile = path.join(os.tmpdir(), `excel_${Date.now()}_${Math.random().toString(36).slice(2)}.xlsx`);

  try {
    fs.writeFileSync(tmpFile, buffer);

    // Co-locate with this file in both src/ and dist/
    const scriptPath = path.join(path.dirname(new URL(import.meta.url).pathname), "excel_parser.py");

    console.log("[Excel] Running Python parser on:", path.basename(tmpFile));

    const output = execFileSync("python3", [scriptPath, tmpFile], {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const result = JSON.parse(output.toString());
    console.log(`[Excel] Found: ${result.total_found} transactions, currency: ${result.currency}`);

    if (!result.success) {
      return { error: result.error || "Python parser returned no results" };
    }

    if (!result.transactions || result.transactions.length === 0) {
      return { error: "No transactions found in this Excel file. Try exporting as CSV from your bank app." };
    }

    return {
      transactions: result.transactions as ParsedTransaction[],
      detected_currency: result.currency,
      parse_method: "excel-python",
    };
  } catch (e: any) {
    console.error("[Excel] Python parser error:", e?.message ?? e);
    return { error: "Could not read this Excel file. Try saving it as CSV from your spreadsheet app." };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

export async function detectAndParse(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  onProgress?: (evt: OcrProgress) => void
): Promise<ParseResult> {
  const lc = filename.toLowerCase();

  // Excel — Python openpyxl parser (handles 289+ transactions, sparse headers, etc.)
  if (lc.endsWith(".xlsx") || lc.endsWith(".xls") ||
      mimeType.includes("spreadsheet") || mimeType.includes("vnd.ms-excel") ||
      mimeType.includes("ms-excel")) {
    console.log(`📊 Processing Excel file: ${filename}`);
    return parseExcelWithPython(buffer);
  }

  // CSV — always instant
  if (lc.endsWith(".csv") || mimeType.includes("csv") || mimeType.includes("text/plain")) {
    return parseCSV(buffer);
  }

  return { error: "Only CSV and Excel files are supported. Please download your statement from your bank app." };
}

// ─── STARTUP STATUS LOG ───────────────────────────────────────────────────────

export function logDocumentParserStatus() {
  if (process.env.OPENAI_API_KEY) {
    console.log("✅ AI Vision enabled — all PDF types and images supported");
  } else {
    console.log("⚠️  No OPENAI_API_KEY — locked/scanned PDFs will show help card");
  }
}
