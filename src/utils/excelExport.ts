import * as XLSX from 'xlsx';
import type { EquityBuy, EquitySell, MutualFund, AlternativeInvestment, CashEntry, DividendEntry } from '../types';
import { getActiveHoldings } from './calculations';

export function exportPortfolioToExcel(
  buys: EquityBuy[],
  sells: EquitySell[],
  funds: MutualFund[],
  alternatives: AlternativeInvestment[],
  cash: CashEntry[],
  dividends: DividendEntry[]
) {
  const wb = XLSX.utils.book_new();

  // 1. Dashboard Summary Sheet
  const activeHoldings = getActiveHoldings(buys, sells);
  const totalEquitiesInvested = activeHoldings.reduce((sum, h) => sum + h.totalInvested, 0);
  const totalEquitiesCurrent = activeHoldings.reduce((sum, h) => sum + h.currentValue, 0);
  
  const totalMFInvested = funds.reduce((sum, f) => sum + f.investedValue, 0);
  const totalMFCurrent = funds.reduce((sum, f) => sum + f.currentValue, 0);

  const totalAltInvested = alternatives.reduce((sum, a) => sum + a.investedAmount, 0);
  const totalAltCurrent = alternatives.reduce((sum, a) => sum + a.currentValue, 0);

  const cashBalance = cash.reduce((sum, c) => sum + (c.type === 'credit' ? c.amount : -c.amount), 0);

  const totalInvested = totalEquitiesInvested + totalMFInvested + totalAltInvested + cashBalance;
  const totalCurrentValue = totalEquitiesCurrent + totalMFCurrent + totalAltCurrent + cashBalance;
  const unrealizedPnL = totalCurrentValue - totalInvested;
  const unrealizedPnLPct = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

  const realizedPnLEquity = sells.reduce((sum, s) => sum + s.realizedPnL, 0);
  const realizedPnLMF = funds.reduce((sum, f) => sum + (f.realizedPnL || 0), 0);
  const totalRealizedPnL = realizedPnLEquity + realizedPnLMF;

  const totalClosedTrades = buys.filter(b => {
    const linkedSells = sells.filter(s => s.linkedBuyId === b.transactionId);
    const soldQty = linkedSells.reduce((sum, s) => sum + s.quantity, 0);
    return soldQty >= b.quantity;
  }).length;
  
  const winClosedTrades = buys.filter(b => {
    const linkedSells = sells.filter(s => s.linkedBuyId === b.transactionId);
    const soldQty = linkedSells.reduce((sum, s) => sum + s.quantity, 0);
    if (soldQty < b.quantity) return false;
    
    const totalSellVal = linkedSells.reduce((sum, s) => sum + s.totalSellValue, 0);
    const totalDivs = dividends.filter(d => d.ticker === b.ticker).reduce((sum, d) => sum + d.amount, 0);
    return (totalSellVal + totalDivs) > b.totalBuyValue;
  }).length;

  const winRate = totalClosedTrades > 0 ? (winClosedTrades / totalClosedTrades) * 100 : 0;

  const summaryRows = [
    { Metric: 'Portfolio Name', Value: 'TR Capital Ledger' },
    { Metric: 'Total Invested Amount (INR)', Value: totalInvested },
    { Metric: 'Current Portfolio Value (INR)', Value: totalCurrentValue },
    { Metric: 'Unrealized P&L (INR)', Value: unrealizedPnL },
    { Metric: 'Unrealized P&L %', Value: unrealizedPnLPct.toFixed(2) + '%' },
    { Metric: 'Realized P&L (INR)', Value: totalRealizedPnL },
    { Metric: 'Win Rate (Closed Trades)', Value: winRate.toFixed(2) + '%' },
    { Metric: 'Cash & Liquidity Balance (INR)', Value: cashBalance },
    { Metric: 'Active Equities Value (INR)', Value: totalEquitiesCurrent },
    { Metric: 'Active Mutual Funds Value (INR)', Value: totalMFCurrent },
    { Metric: 'Alternative Assets Value (INR)', Value: totalAltCurrent },
    { Metric: 'Export Date', Value: new Date().toLocaleDateString('en-IN') }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Dashboard Summary');

  // 2. Buy Book Sheet
  const flatBuys: any[] = [];
  buys.forEach(b => {
    flatBuys.push({
      'Transaction ID': b.transactionId,
      'Date': b.date,
      'Ticker': b.ticker,
      'Stock Name': b.stockName,
      'Industry': b.industry,
      'Quantity': b.quantity,
      'Avg Buy Price (₹)': b.avgBuyPrice,
      'Fees (₹)': b.fees,
      'Total Buy Value (₹)': b.totalBuyValue,
      'Current Price (₹)': b.currentPrice,
      'Current Value (₹)': b.currentValue,
      'Target Price (₹)': b.targetPrice,
      'Holding Duration': b.holdingDuration,
      'Opinion/Thesis': b.opinion,
      'Type': 'Primary Buy'
    });
    
    // Add DCA subsequent purchases
    (b.subsequentPurchases || []).forEach((sub, sIdx) => {
      flatBuys.push({
        'Transaction ID': `${b.transactionId}-SUB-${sIdx + 1}`,
        'Date': sub.date,
        'Ticker': sub.ticker,
        'Stock Name': sub.stockName,
        'Industry': sub.industry,
        'Quantity': sub.quantity,
        'Avg Buy Price (₹)': sub.avgBuyPrice,
        'Fees (₹)': sub.fees,
        'Total Buy Value (₹)': sub.totalBuyValue,
        'Current Price (₹)': sub.currentPrice,
        'Current Value (₹)': sub.currentValue,
        'Target Price (₹)': sub.targetPrice,
        'Holding Duration': sub.holdingDuration,
        'Opinion/Thesis': sub.opinion,
        'Type': 'DCA Subsequent'
      });
    });
  });
  const wsBuys = XLSX.utils.json_to_sheet(flatBuys);
  XLSX.utils.book_append_sheet(wb, wsBuys, 'Buy Book');

  // 3. Sell Book Sheet
  const sellRows = sells.map(s => ({
    'Transaction ID': s.transactionId,
    'Linked Buy ID': s.linkedBuyId,
    'Date': s.date,
    'Ticker': s.ticker,
    'Quantity Sold': s.quantity,
    'Avg Sell Price (₹)': s.avgSellPrice,
    'Fees (₹)': s.fees,
    'Total Sell Value (₹)': s.totalSellValue,
    'Dividends Received (₹)': s.dividendsReceived,
    'Realized P&L (₹)': s.realizedPnL,
    'Realized P&L %': s.realizedPnLPct.toFixed(2) + '%',
    'Sell PE': s.sellPE,
    'Partial Sell Tag': s.isPartialSell ? 'Yes' : 'No',
    'Sell Notes': s.partialSellNotes
  }));
  const wsSells = XLSX.utils.json_to_sheet(sellRows);
  XLSX.utils.book_append_sheet(wb, wsSells, 'Sell Book');

  // 4. Mutual Funds Sheet
  const mfRows = funds.map(f => ({
    'Fund ID': f.id,
    'Scheme Name': f.schemeName,
    'Scheme Code': f.schemeCode,
    'Date Purchased': f.dateOfBuy,
    'Buy NAV (₹)': f.buyNAV,
    'Units Held': f.units,
    'Fund AUM (₹ Cr)': f.aum,
    'Current NAV (₹)': f.currentNAV,
    'Invested Value (₹)': f.investedValue,
    'Current Value (₹)': f.currentValue,
    'Unrealized P&L (₹)': f.unrealizedPnL,
    'Unrealized P&L %': f.unrealizedPnLPct.toFixed(2) + '%',
    'Realized P&L (₹)': f.realizedPnL
  }));
  const wsFunds = XLSX.utils.json_to_sheet(mfRows);
  XLSX.utils.book_append_sheet(wb, wsFunds, 'Mutual Funds');

  // 5. Alternatives Sheet
  const altRows = alternatives.map(a => ({
    'Asset ID': a.id,
    'Asset Name': a.name,
    'Category': a.category,
    'Date Invested': a.dateOfInvestment,
    'Invested Amount (₹)': a.investedAmount,
    'Current Value (₹)': a.currentValue,
    'Unrealized P&L (₹)': a.unrealizedPnL,
    'Unrealized P&L %': a.unrealizedPnLPct.toFixed(2) + '%',
    'Notes': a.notes
  }));
  const wsAlts = XLSX.utils.json_to_sheet(altRows);
  XLSX.utils.book_append_sheet(wb, wsAlts, 'Alternatives');

  // 6. Cash Ledger Sheet
  const cashRows = cash.map(c => ({
    'Entry ID': c.id,
    'Date': c.date,
    'Type': c.type.toUpperCase(),
    'Amount (₹)': c.amount,
    'Description': c.description
  }));
  const wsCash = XLSX.utils.json_to_sheet(cashRows);
  XLSX.utils.book_append_sheet(wb, wsCash, 'Cash Ledger');

  // 7. Dividends Sheet
  const divRows = dividends.map(d => ({
    'Dividend ID': d.id,
    'Date': d.date,
    'Ticker': d.ticker,
    'Amount (₹)': d.amount,
    'Description': d.description
  }));
  const wsDivs = XLSX.utils.json_to_sheet(divRows);
  XLSX.utils.book_append_sheet(wb, wsDivs, 'Dividend Tracker');

  // Write and Save
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `TRCapital_Export_${dateStr}.xlsx`);
}
