import * as XLSX from 'xlsx';
import type { EquityBuy, EquitySell, MutualFund, AlternativeInvestment, CashEntry } from '../types';
import { generateId } from './idGenerator';

// Generate and download a blank structured template sheet
export function downloadImportTemplate() {
  const wb = XLSX.utils.book_new();

  // 1. Buy Template
  const buyCols = [
    {
      'Ticker (e.g. RELIANCE.NS)*': 'RELIANCE.NS',
      'Date (YYYY-MM-DD)*': '2024-01-15',
      'Quantity*': 50,
      'Avg Buy Price (INR)*': 2450.50,
      'Fees (INR)': 120.00,
      'Target Price (INR)': 3000.00,
      'Holding Duration': '2 years',
      'Opinion/Thesis': 'Strong cash flows and expansion in retail/telecom.'
    }
  ];
  const wsBuy = XLSX.utils.json_to_sheet(buyCols);
  XLSX.utils.book_append_sheet(wb, wsBuy, 'BUY_TEMPLATE');

  // 2. Sell Template
  const sellCols = [
    {
      'Linked Buy ID*': 'TRC-EQ-20240115-1234',
      'Ticker*': 'RELIANCE.NS',
      'Date (YYYY-MM-DD)*': '2024-06-20',
      'Quantity Sold*': 20,
      'Avg Sell Price (INR)*': 2850.00,
      'Fees (INR)': 75.00,
      'Dividends Received (INR)': 200.00,
      'Sell PE': 28.5,
      'Notes (For partial sells)': 'Booked partial profit.'
    }
  ];
  const wsSell = XLSX.utils.json_to_sheet(sellCols);
  XLSX.utils.book_append_sheet(wb, wsSell, 'SELL_TEMPLATE');

  // 3. Mutual Funds Template
  const mfCols = [
    {
      'Scheme Code (MFAPI)*': '120503',
      'Scheme Name*': 'HDFC Flexi Cap Fund - Direct Plan - Growth',
      'Date of Buy (YYYY-MM-DD)*': '2023-05-10',
      'Buy NAV (INR)*': 125.40,
      'Units*': 79.74,
      'User Identification ID (Optional)': 'HDFC_FLEXICAP_001'
    }
  ];
  const wsMF = XLSX.utils.json_to_sheet(mfCols);
  XLSX.utils.book_append_sheet(wb, wsMF, 'MF_TEMPLATE');

  // 4. Alternatives Template
  const altCols = [
    {
      'Asset Name*': 'Physical Gold Sovereign',
      'Category (e.g. Gold, Real Estate, Crypto)*': 'Gold',
      'Invested Amount (INR)*': 120000,
      'Current Value (INR)*': 142000,
      'Date of Investment (YYYY-MM-DD)*': '2022-12-01',
      'Notes': 'Stored in locker.'
    }
  ];
  const wsAlt = XLSX.utils.json_to_sheet(altCols);
  XLSX.utils.book_append_sheet(wb, wsAlt, 'ALT_TEMPLATE');

  // 5. Cash Template
  const cashCols = [
    {
      'Date (YYYY-MM-DD)*': '2024-01-01',
      'Type (credit/debit)*': 'credit',
      'Amount (INR)*': 500000,
      'Description*': 'Initial Capital Injection'
    }
  ];
  const wsCash = XLSX.utils.json_to_sheet(cashCols);
  XLSX.utils.book_append_sheet(wb, wsCash, 'CASH_TEMPLATE');

  XLSX.writeFile(wb, 'TRCapital_Bulk_Import_Template.xlsx');
}

export interface ValidationError {
  sheet: string;
  row: number;
  field: string;
  message: string;
  rawValue: any;
}

export interface ParsedImportData {
  buys: EquityBuy[];
  sells: EquitySell[];
  funds: MutualFund[];
  alternatives: AlternativeInvestment[];
  cash: CashEntry[];
  errors: ValidationError[];
}

export async function parseAndValidateExcel(
  file: File,
  _existingBuyIds: string[],
  _existingSellIds: string[]
): Promise<ParsedImportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const result: ParsedImportData = {
          buys: [],
          sells: [],
          funds: [],
          alternatives: [],
          cash: [],
          errors: []
        };

        const validateDate = (dateVal: any): string | null => {
          if (!dateVal) return null;
          let dateStr = String(dateVal).trim();
          
          // SheetJS can parse dates into numbers sometimes
          if (!isNaN(Number(dateStr)) && Number(dateStr) > 30000) {
            // Excel serial date format conversion
            const date = new Date((Number(dateStr) - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
          }

          const parsed = Date.parse(dateStr);
          if (isNaN(parsed)) return null;
          return new Date(parsed).toISOString().split('T')[0];
        };

        // --- 1. Parse Buys ---
        const buySheet = workbook.Sheets['BUY_TEMPLATE'];
        if (buySheet) {
          const rows = XLSX.utils.sheet_to_json(buySheet) as any[];
          rows.forEach((row, index) => {
            const rowIndex = index + 2; // 1-indexed Excel row offset (header is row 1)
            const ticker = row['Ticker (e.g. RELIANCE.NS)*']?.toString().trim();
            const dateStr = validateDate(row['Date (YYYY-MM-DD)*']);
            const qty = Number(row['Quantity*']);
            const avgPrice = Number(row['Avg Buy Price (INR)*']);
            const fees = Number(row['Fees (INR)'] || 0);
            const target = Number(row['Target Price (INR)'] || 0);
            const duration = row['Holding Duration']?.toString().trim() || '6 months';
            const opinion = row['Opinion/Thesis']?.toString().trim() || '';

            if (!ticker) {
              result.errors.push({ sheet: 'BUY_TEMPLATE', row: rowIndex, field: 'Ticker', message: 'Ticker is required', rawValue: row['Ticker (e.g. RELIANCE.NS)*'] });
            }
            if (!dateStr) {
              result.errors.push({ sheet: 'BUY_TEMPLATE', row: rowIndex, field: 'Date', message: 'Valid date is required (YYYY-MM-DD)', rawValue: row['Date (YYYY-MM-DD)*'] });
            }
            if (isNaN(qty) || qty <= 0) {
              result.errors.push({ sheet: 'BUY_TEMPLATE', row: rowIndex, field: 'Quantity', message: 'Quantity must be positive number', rawValue: row['Quantity*'] });
            }
            if (isNaN(avgPrice) || avgPrice <= 0) {
              result.errors.push({ sheet: 'BUY_TEMPLATE', row: rowIndex, field: 'Avg Price', message: 'Average price must be positive number', rawValue: row['Avg Buy Price (INR)*'] });
            }
            if (isNaN(fees) || fees < 0) {
              result.errors.push({ sheet: 'BUY_TEMPLATE', row: rowIndex, field: 'Fees', message: 'Fees must be non-negative', rawValue: row['Fees (INR)'] });
            }

            if (result.errors.filter(e => e.sheet === 'BUY_TEMPLATE' && e.row === rowIndex).length === 0) {
              const buyId = generateId('EQ');
              result.buys.push({
                transactionId: buyId,
                date: dateStr!,
                ticker: ticker!.toUpperCase(),
                stockName: ticker!.split('.')[0],
                industry: 'Assigned on Sync',
                quantity: qty,
                avgBuyPrice: avgPrice,
                fees,
                totalBuyValue: (qty * avgPrice) + fees,
                currentPrice: avgPrice, // fallback
                currentValue: qty * avgPrice,
                targetPrice: target,
                pctToTarget: target > 0 ? ((target - avgPrice) / avgPrice) * 100 : 0,
                holdingDuration: duration,
                opinion,
                subsequentPurchases: [],
                currentPE: 0,
                contactNotes: [],
                isPartialSold: false
              });
            }
          });
        }

        // --- 2. Parse Sells ---
        const sellSheet = workbook.Sheets['SELL_TEMPLATE'];
        if (sellSheet) {
          const rows = XLSX.utils.sheet_to_json(sellSheet) as any[];
          rows.forEach((row, index) => {
            const rowIndex = index + 2;
            const linkedId = row['Linked Buy ID*']?.toString().trim();
            const ticker = row['Ticker*']?.toString().trim();
            const dateStr = validateDate(row['Date (YYYY-MM-DD)*']);
            const qty = Number(row['Quantity Sold*']);
            const sellPrice = Number(row['Avg Sell Price (INR)*']);
            const fees = Number(row['Fees (INR)'] || 0);
            const divs = Number(row['Dividends Received (INR)'] || 0);
            const sellPE = Number(row['Sell PE'] || 0);
            const notes = row['Notes (For partial sells)']?.toString().trim() || '';

            if (!linkedId) {
              result.errors.push({ sheet: 'SELL_TEMPLATE', row: rowIndex, field: 'Linked Buy ID', message: 'Linked Buy ID is required to match against buy ledger', rawValue: row['Linked Buy ID*'] });
            }
            if (!ticker) {
              result.errors.push({ sheet: 'SELL_TEMPLATE', row: rowIndex, field: 'Ticker', message: 'Ticker is required', rawValue: row['Ticker*'] });
            }
            if (!dateStr) {
              result.errors.push({ sheet: 'SELL_TEMPLATE', row: rowIndex, field: 'Date', message: 'Valid date is required (YYYY-MM-DD)', rawValue: row['Date (YYYY-MM-DD)*'] });
            }
            if (isNaN(qty) || qty <= 0) {
              result.errors.push({ sheet: 'SELL_TEMPLATE', row: rowIndex, field: 'Quantity Sold', message: 'Quantity must be positive number', rawValue: row['Quantity Sold*'] });
            }
            if (isNaN(sellPrice) || sellPrice <= 0) {
              result.errors.push({ sheet: 'SELL_TEMPLATE', row: rowIndex, field: 'Avg Sell Price', message: 'Average sell price must be positive number', rawValue: row['Avg Sell Price (INR)*'] });
            }

            if (result.errors.filter(e => e.sheet === 'SELL_TEMPLATE' && e.row === rowIndex).length === 0) {
              const sellId = generateId('EQ');
              result.sells.push({
                transactionId: sellId,
                linkedBuyId: linkedId!,
                date: dateStr!,
                ticker: ticker!.toUpperCase(),
                quantity: qty,
                avgSellPrice: sellPrice,
                fees,
                totalSellValue: (qty * sellPrice) - fees,
                dividendsReceived: divs,
                realizedPnL: 0, // Computed post-import in reducer merge
                realizedPnLPct: 0,
                sellPE,
                isPartialSell: false, // Calculated on link check
                partialSellNotes: notes,
                contactNotes: []
              });
            }
          });
        }

        // --- 3. Parse Mutual Funds ---
        const mfSheet = workbook.Sheets['MF_TEMPLATE'];
        if (mfSheet) {
          const rows = XLSX.utils.sheet_to_json(mfSheet) as any[];
          rows.forEach((row, index) => {
            const rowIndex = index + 2;
            const code = row['Scheme Code (MFAPI)*']?.toString().trim();
            const name = row['Scheme Name*']?.toString().trim();
            const dateStr = validateDate(row['Date of Buy (YYYY-MM-DD)*']);
            const buyNav = Number(row['Buy NAV (INR)*']);
            const units = Number(row['Units*']);
            const idVal = row['User Identification ID (Optional)']?.toString().trim() || `TRC-MF-${code}-${Date.now().toString().slice(-4)}`;

            if (!code) {
              result.errors.push({ sheet: 'MF_TEMPLATE', row: rowIndex, field: 'Scheme Code', message: 'Scheme code is required', rawValue: row['Scheme Code (MFAPI)*'] });
            }
            if (!name) {
              result.errors.push({ sheet: 'MF_TEMPLATE', row: rowIndex, field: 'Scheme Name', message: 'Scheme name is required', rawValue: row['Scheme Name*'] });
            }
            if (!dateStr) {
              result.errors.push({ sheet: 'MF_TEMPLATE', row: rowIndex, field: 'Date of Buy', message: 'Valid date is required', rawValue: row['Date of Buy (YYYY-MM-DD)*'] });
            }
            if (isNaN(buyNav) || buyNav <= 0) {
              result.errors.push({ sheet: 'MF_TEMPLATE', row: rowIndex, field: 'Buy NAV', message: 'NAV must be positive number', rawValue: row['Buy NAV (INR)*'] });
            }
            if (isNaN(units) || units <= 0) {
              result.errors.push({ sheet: 'MF_TEMPLATE', row: rowIndex, field: 'Units', message: 'Units must be positive number', rawValue: row['Units*'] });
            }

            if (result.errors.filter(e => e.sheet === 'MF_TEMPLATE' && e.row === rowIndex).length === 0) {
              const investedVal = units * buyNav;
              result.funds.push({
                id: idVal,
                schemeName: name!,
                schemeCode: code!,
                dateOfBuy: dateStr!,
                buyNAV: buyNav,
                units,
                aum: 0,
                currentNAV: buyNav,
                currentValue: investedVal,
                investedValue: investedVal,
                unrealizedPnL: 0,
                unrealizedPnLPct: 0,
                realizedPnL: 0
              });
            }
          });
        }

        // --- 4. Parse Alternatives ---
        const altSheet = workbook.Sheets['ALT_TEMPLATE'];
        if (altSheet) {
          const rows = XLSX.utils.sheet_to_json(altSheet) as any[];
          rows.forEach((row, index) => {
            const rowIndex = index + 2;
            const name = row['Asset Name*']?.toString().trim();
            const category = row['Category (e.g. Gold, Real Estate, Crypto)*']?.toString().trim();
            const invested = Number(row['Invested Amount (INR)*']);
            const current = Number(row['Current Value (INR)*']);
            const dateStr = validateDate(row['Date of Investment (YYYY-MM-DD)*']);
            const notes = row['Notes']?.toString().trim() || '';

            if (!name) {
              result.errors.push({ sheet: 'ALT_TEMPLATE', row: rowIndex, field: 'Asset Name', message: 'Name is required', rawValue: row['Asset Name*'] });
            }
            if (!category) {
              result.errors.push({ sheet: 'ALT_TEMPLATE', row: rowIndex, field: 'Category', message: 'Category is required', rawValue: row['Category (e.g. Gold, Real Estate, Crypto)*'] });
            }
            if (!dateStr) {
              result.errors.push({ sheet: 'ALT_TEMPLATE', row: rowIndex, field: 'Date', message: 'Valid date is required', rawValue: row['Date of Investment (YYYY-MM-DD)*'] });
            }
            if (isNaN(invested) || invested <= 0) {
              result.errors.push({ sheet: 'ALT_TEMPLATE', row: rowIndex, field: 'Invested Amount', message: 'Invested amount must be positive number', rawValue: row['Invested Amount (INR)*'] });
            }
            if (isNaN(current) || current < 0) {
              result.errors.push({ sheet: 'ALT_TEMPLATE', row: rowIndex, field: 'Current Value', message: 'Current value must be non-negative', rawValue: row['Current Value (INR)*'] });
            }

            if (result.errors.filter(e => e.sheet === 'ALT_TEMPLATE' && e.row === rowIndex).length === 0) {
              const altId = generateId('ALT');
              result.alternatives.push({
                id: altId,
                name: name!,
                category: category!,
                investedAmount: invested,
                currentValue: current,
                dateOfInvestment: dateStr!,
                notes,
                unrealizedPnL: current - invested,
                unrealizedPnLPct: invested > 0 ? ((current - invested) / invested) * 100 : 0
              });
            }
          });
        }

        // --- 5. Parse Cash Ledger ---
        const cashSheet = workbook.Sheets['CASH_TEMPLATE'];
        if (cashSheet) {
          const rows = XLSX.utils.sheet_to_json(cashSheet) as any[];
          rows.forEach((row, index) => {
            const rowIndex = index + 2;
            const dateStr = validateDate(row['Date (YYYY-MM-DD)*']);
            const type = row['Type (credit/debit)*']?.toString().toLowerCase().trim();
            const amount = Number(row['Amount (INR)*']);
            const desc = row['Description*']?.toString().trim();

            if (!dateStr) {
              result.errors.push({ sheet: 'CASH_TEMPLATE', row: rowIndex, field: 'Date', message: 'Valid date is required', rawValue: row['Date (YYYY-MM-DD)*'] });
            }
            if (type !== 'credit' && type !== 'debit') {
              result.errors.push({ sheet: 'CASH_TEMPLATE', row: rowIndex, field: 'Type', message: 'Type must be exactly "credit" or "debit"', rawValue: row['Type (credit/debit)*'] });
            }
            if (isNaN(amount) || amount <= 0) {
              result.errors.push({ sheet: 'CASH_TEMPLATE', row: rowIndex, field: 'Amount', message: 'Amount must be positive number', rawValue: row['Amount (INR)*'] });
            }
            if (!desc) {
              result.errors.push({ sheet: 'CASH_TEMPLATE', row: rowIndex, field: 'Description', message: 'Description is required', rawValue: row['Description*'] });
            }

            if (result.errors.filter(e => e.sheet === 'CASH_TEMPLATE' && e.row === rowIndex).length === 0) {
              const cashId = generateId('CASH');
              result.cash.push({
                id: cashId,
                date: dateStr!,
                type: type as 'credit' | 'debit',
                amount,
                description: desc!
              });
            }
          });
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
