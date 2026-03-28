import { parse as csvParse } from "csv-parse/sync";

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
}

function cleanAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$£€₦¥₹,\s]/g, "").replace(/\((.+)\)/, "-$1");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

const BALANCE_KEYWORDS = /\b(balance|opening|closing|brought forward|carried forward|total|sub[\-\s]?total)\b/i;

function parseDate(raw: string): string | null {
  if (!raw) return null;
  raw = raw.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  // DD/MM/YYYY or MM/DD/YYYY — try both, prefer DD/MM/YYYY
  const slash4 = raw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (slash4) {
    const [, a, b, y] = slash4;
    const d1 = new Date(`${y}-${b}-${a}`);
    if (!isNaN(d1.getTime())) return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }

  // DD MMM YYYY or DD MMM YY
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const mdy = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/);
  if (mdy) {
    const [, d, m, y] = mdy;
    const mo = months[m.toLowerCase()];
    if (mo) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${mo}-${d.padStart(2, "0")}`;
    }
  }

  // DDMMMYY compact
  const compact = raw.match(/^(\d{2})([A-Za-z]{3})(\d{2,4})$/);
  if (compact) {
    const [, d, m, y] = compact;
    const mo = months[m.toLowerCase()];
    if (mo) {
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${mo}-${d}`;
    }
  }

  // Try native Date parse as last resort
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return null;
}

const EXACT_ONLY_KEYWORDS = new Set(["cr", "dr", "date", "value", "memo"]);

function detectHeader(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toLowerCase();
    if (keywords.some((k) => h === k || (!EXACT_ONLY_KEYWORDS.has(k) && k.length > 3 && h.includes(k)))) return i;
  }
  return -1;
}

export async function parseCSV(buffer: Buffer): Promise<ParseResult> {
  try {
    const text = buffer.toString("utf-8");

    let delimiter = ",";
    const semicolonCount = (text.match(/;/g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;
    if (semicolonCount > commaCount) delimiter = ";";

    const rows: string[][] = csvParse(text, {
      delimiter,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    if (rows.length < 2) return { error: "Could not parse CSV. Please check the file format." };

    const headers = rows[0].map((h) => h.toLowerCase().trim());

    const dateIdx = detectHeader(headers, ["date", "transaction date", "trans date", "value date", "posting date", "txn date"]);
    const descIdx = detectHeader(headers, ["description", "details", "narrative", "merchant", "particulars", "transaction details", "remarks", "memo", "reference"]);
    const amtIdx = detectHeader(headers, ["amount", "value", "transaction amount", "net amount"]);
    const debitIdx = detectHeader(headers, ["debit", "dr", "withdrawals", "debit amount", "money out", "withdrawal"]);
    const creditIdx = detectHeader(headers, ["credit", "cr", "deposits", "credit amount", "money in", "deposit"]);

    if (dateIdx === -1) return { error: "Could not parse CSV. Please check the file format." };

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const dateRaw = row[dateIdx];
      const date = parseDate(dateRaw);
      if (!date) continue;

      const desc = descIdx >= 0 ? (row[descIdx] || "").trim().slice(0, 100) : "Transaction";
      if (BALANCE_KEYWORDS.test(desc)) continue;

      let amount: number | null = null;
      let type: "income" | "expense" = "expense";

      if (debitIdx >= 0 || creditIdx >= 0) {
        const debit = debitIdx >= 0 ? cleanAmount(row[debitIdx] || "") : null;
        const credit = creditIdx >= 0 ? cleanAmount(row[creditIdx] || "") : null;
        if (debit && debit > 0) { amount = debit; type = "expense"; }
        else if (credit && credit > 0) { amount = credit; type = "income"; }
      } else if (amtIdx >= 0) {
        const raw = cleanAmount(row[amtIdx] || "");
        if (raw !== null) {
          amount = Math.abs(raw);
          type = raw < 0 ? "expense" : "income";
        }
      }

      if (!amount || amount === 0) continue;

      transactions.push({ date, description: desc || "Transaction", amount, type, currency: "USD", confidence: "high" });
    }

    if (transactions.length === 0) return { error: "Could not parse CSV. Please check the file format." };

    return { transactions };
  } catch (err: any) {
    console.error("[CSV Parser error]", err?.message || err);
    return { error: "Could not parse CSV. Please check the file format." };
  }
}

export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  try {
    // Dynamic import to avoid ESM issues with pdf-parse
    const pdfParse = (await import("pdf-parse")).default;
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    const DATE_PATTERNS = [
      /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/,
      /\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/,
      /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i,
      /\b(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2,4})\b/i,
    ];

    const AMOUNT_PATTERN = /[\d,]+\.?\d{0,2}/g;

    const INCOME_KEYWORDS = /\b(credit|cr\b|deposit|salary|payment received|transfer in|inflow|reversal|refund|cashback|interest)\b/i;
    const EXPENSE_KEYWORDS = /\b(debit|dr\b|withdrawal|purchase|pos\b|atm\b|transfer out|outflow|payment to|charge|fee|bill)\b/i;

    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };

    function extractDate(line: string): string | null {
      // DD/MM/YYYY
      const m1 = line.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);
      if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;

      // YYYY-MM-DD
      const m2 = line.match(/\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/);
      if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

      // DD MMM YYYY
      const m3 = line.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i);
      if (m3) return `${m3[3]}-${months[m3[2].toLowerCase()]}-${m3[1].padStart(2, "0")}`;

      // DD MMM YY
      const m4 = line.match(/\b(\d{2})(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(\d{2,4})\b/i);
      if (m4) {
        const year = m4[3].length === 2 ? `20${m4[3]}` : m4[3];
        return `${year}-${months[m4[2].toLowerCase()]}-${m4[1]}`;
      }

      return null;
    }

    function extractAmounts(line: string): number[] {
      const matches = line.match(AMOUNT_PATTERN) || [];
      return matches
        .map((m) => parseFloat(m.replace(/,/g, "")))
        .filter((n) => !isNaN(n) && n > 0 && n < 10000000);
    }

    const transactions: ParsedTransaction[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const date = extractDate(line);
      if (!date) continue;
      if (BALANCE_KEYWORDS.test(line)) continue;

      // Look for amount in this line or next 2 lines
      let amountLine = line;
      let descLine = line;
      let amounts = extractAmounts(line);

      if (amounts.length === 0 && i + 1 < lines.length) {
        descLine = lines[i + 1];
        amounts = extractAmounts(lines[i + 1]);
        if (amounts.length === 0 && i + 2 < lines.length) {
          amounts = extractAmounts(lines[i + 2]);
          amountLine = lines[i + 2];
        }
      }

      if (amounts.length === 0) continue;

      const amount = amounts[amounts.length - 1]; // take last amount (usually the transaction amount)

      const combinedLine = [line, descLine, amountLine].join(" ");
      if (BALANCE_KEYWORDS.test(combinedLine)) continue;

      let type: "income" | "expense" = "expense";
      let confidence: "high" | "medium" | "low" = "medium";

      if (INCOME_KEYWORDS.test(combinedLine)) { type = "income"; confidence = "high"; }
      else if (EXPENSE_KEYWORDS.test(combinedLine)) { type = "expense"; confidence = "high"; }

      // Extract description: remove date and amounts from line
      const desc = descLine
        .replace(/\d{2}[\/\-]\d{2}[\/\-]\d{4}/, "")
        .replace(/\d{4}[\/\-]\d{2}[\/\-]\d{2}/, "")
        .replace(/[$£€₦¥₹]?[\d,]+\.?\d{0,2}/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);

      const key = `${date}|${amount}|${desc.slice(0, 20)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      transactions.push({
        date,
        description: desc || "Transaction",
        amount,
        type,
        currency: "USD",
        confidence,
      });
    }

    // Sort by date
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    if (transactions.length === 0) {
      return { error: "Could not extract transactions from PDF. Try exporting as CSV from your bank instead." };
    }

    return { transactions };
  } catch (err: any) {
    return { error: "Could not extract transactions from PDF. Try exporting as CSV from your bank instead." };
  }
}

export async function detectAndParse(buffer: Buffer, filename: string, mimeType: string): Promise<ParseResult> {
  const lc = filename.toLowerCase();
  if (lc.endsWith(".csv") || mimeType.includes("csv") || mimeType.includes("text/plain")) {
    return parseCSV(buffer);
  } else if (lc.endsWith(".pdf") || mimeType.includes("pdf")) {
    return parsePDF(buffer);
  }
  return { error: "Only PDF and CSV files are supported. Image scanning coming soon!" };
}
