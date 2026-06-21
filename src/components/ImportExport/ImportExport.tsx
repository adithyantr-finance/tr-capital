import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAuth } from '../../context/AuthContext';
import { downloadImportTemplate, parseAndValidateExcel } from '../../utils/excelImport';
import type { ParsedImportData } from '../../utils/excelImport';
import { exportPortfolioToExcel } from '../../utils/excelExport';
import { useToast } from '../shared/Toast';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertTriangle,
  FileSpreadsheet as ExcelIcon,
  Trash,
  RefreshCw
} from 'lucide-react';

interface ImportExportProps {
  onNavigate: (tab: string) => void;
}

export const ImportExport: React.FC<ImportExportProps> = ({ onNavigate }) => {
  const { buys, sells, funds, alternatives, cash, dividends, dispatch } = usePortfolio();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedImportData | null>(null);

  const username = currentUser?.username || '';

  // Gather existing transaction IDs to prevent duplicates
  const existingBuyIds = useMemo(() => buys.map(b => b.transactionId), [buys]);
  const existingSellIds = useMemo(() => sells.map(s => s.transactionId), [sells]);

  const handleExport = () => {
    try {
      exportPortfolioToExcel(buys, sells, funds, alternatives, cash, dividends);
      showToast('Portfolio exported to Excel successfully!');
    } catch (e) {
      showToast('Export failed.', 'error');
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadImportTemplate();
      showToast('Import template downloaded!');
    } catch (e) {
      showToast('Failed to download template.', 'error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('Invalid file format. Please upload an Excel (.xlsx) file.', 'error');
      return;
    }

    setUploadedFile(file);
    setParsing(true);
    setParsedData(null);

    try {
      const result = await parseAndValidateExcel(file, existingBuyIds, existingSellIds);
      setParsedData(result);
      if (result.errors.length > 0) {
        showToast(`Parsed with ${result.errors.length} validation errors.`, 'error');
      } else {
        showToast('File parsed and validated successfully!');
      }
    } catch (err) {
      showToast('Failed to parse Excel file.', 'error');
      console.error(err);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parsedData || !username) return;

    const getStorageKey = (key: string) => `trcapital_user_${username}_${key}`;

    // Read current database values directly from localStorage
    const storedBuys = localStorage.getItem(getStorageKey('buys'));
    const storedSells = localStorage.getItem(getStorageKey('sells'));
    const storedFunds = localStorage.getItem(getStorageKey('funds'));
    const storedAlts = localStorage.getItem(getStorageKey('alternatives'));
    const storedCash = localStorage.getItem(getStorageKey('cash'));

    const currentBuys = storedBuys ? JSON.parse(storedBuys) : [];
    const currentSells = storedSells ? JSON.parse(storedSells) : [];
    const currentFunds = storedFunds ? JSON.parse(storedFunds) : [];
    const currentAlts = storedAlts ? JSON.parse(storedAlts) : [];
    const currentCash = storedCash ? JSON.parse(storedCash) : [];

    // Filter duplicates to prevent double-guarding
    const finalBuys = parsedData.buys.filter(b => !currentBuys.some((x: any) => x.transactionId === b.transactionId));
    const finalSells = parsedData.sells.filter(s => !currentSells.some((x: any) => x.transactionId === s.transactionId));
    const finalFunds = parsedData.funds.filter(f => !currentFunds.some((x: any) => x.id === f.id));
    const finalAlts = parsedData.alternatives.filter(a => !currentAlts.some((x: any) => x.id === a.id));
    const finalCash = parsedData.cash.filter(c => !currentCash.some((x: any) => x.id === c.id));

    const mergedBuys = [...currentBuys, ...finalBuys];
    const mergedSells = [...currentSells, ...finalSells];
    const mergedFunds = [...currentFunds, ...finalFunds];
    const mergedAlts = [...currentAlts, ...finalAlts];
    const mergedCash = [...currentCash, ...finalCash];

    // Step 1: Write directly to namespaced localStorage first
    localStorage.setItem(getStorageKey('buys'), JSON.stringify(mergedBuys));
    localStorage.setItem(getStorageKey('sells'), JSON.stringify(mergedSells));
    localStorage.setItem(getStorageKey('funds'), JSON.stringify(mergedFunds));
    localStorage.setItem(getStorageKey('alternatives'), JSON.stringify(mergedAlts));
    localStorage.setItem(getStorageKey('cash'), JSON.stringify(mergedCash));

    // Step 2: Dispatch bulk action payloads to the React context reducer
    dispatch({ type: 'BULK_IMPORT_EQUITIES', payload: finalBuys });
    dispatch({ type: 'BULK_IMPORT_SELLS', payload: finalSells });
    dispatch({ type: 'BULK_IMPORT_MF', payload: finalFunds });
    dispatch({ type: 'BULK_IMPORT_ALT', payload: finalAlts });
    dispatch({ type: 'BULK_IMPORT_CASH', payload: finalCash });

    // Step 3: Show success toast with actual counts of newly saved records
    showToast(`Bulk Import Complete: Imported ${finalBuys.length} Buys, ${finalSells.length} Sells, ${finalFunds.length} MFs, ${finalAlts.length} Alternatives!`);
    
    // Clear state
    setUploadedFile(null);
    setParsedData(null);

    // Step 4: Redirect user to the equity tab to instantly view data
    onNavigate('equity');
  };

  const handleCancelImport = () => {
    setUploadedFile(null);
    setParsedData(null);
  };

  return (
    <div className="space-y-6 select-text">
      <div>
        <h2 className="text-xl font-bold font-sans text-cream">Bulk Import / Export</h2>
        <p className="text-[12px] text-muted">Backup your entire ledger or import historical trades in bulk</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
        
        {/* EXPORT INTERFACE CARD */}
        <div className="bg-surface border border-border rounded p-6 flex flex-col justify-between h-[220px]">
          <div>
            <div className="p-3 bg-primary/10 text-primary rounded w-fit mb-4">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-[14px] font-bold text-[#E8DCC8] uppercase tracking-wider">Export Portfolio</h3>
            <p className="text-[12px] text-muted mt-2 leading-relaxed">
              Export all transactions, cash flows, mutual funds and alternatives to a multi-sheet Microsoft Excel file.
            </p>
          </div>
          <button
            onClick={handleExport}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors shadow-lg shadow-primary/5 cursor-pointer"
          >
            Generate Excel Backup
          </button>
        </div>

        {/* TEMPLATE DOWNLOAD INTERFACE CARD */}
        <div className="bg-surface border border-border rounded p-6 flex flex-col justify-between h-[220px]">
          <div>
            <div className="p-3 bg-secondary/10 text-secondary rounded w-fit mb-4">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-[14px] font-bold text-[#E8DCC8] uppercase tracking-wider">Download Import Template</h3>
            <p className="text-[12px] text-muted mt-2 leading-relaxed">
              Download the standardized import template featuring required columns and headers to structure bulk uploads.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="w-full py-2.5 bg-elevated border border-border hover:bg-[#1E1E2E] text-cream font-bold rounded text-[12px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            Download Excel Template
          </button>
        </div>
      </div>

      {/* BULK EXCEL UPLOADER MODULE */}
      <div className="bg-surface border border-border rounded p-6 space-y-6">
        <h3 className="text-[14px] font-bold text-[#E8DCC8] uppercase tracking-wider select-none">Bulk Excel Import</h3>

        {!uploadedFile ? (
          /* File Upload Selector */
          <div className="relative border-2 border-dashed border-border rounded-lg p-10 text-center bg-background/50 hover:bg-background/80 transition-colors select-none cursor-pointer">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="space-y-2">
              <Upload className="w-8 h-8 text-primary mx-auto" />
              <p className="text-[13px] text-cream font-bold">Select Import Spreadsheet</p>
              <p className="text-[11px] text-hint">Supports Excel spreadsheet file formats (.xlsx, .xls)</p>
            </div>
          </div>
        ) : (
          /* Upload / Preview Area */
          <div className="space-y-5">
            {/* File Info Bar */}
            <div className="flex items-center justify-between p-4 bg-background border border-border rounded">
              <div className="flex items-center gap-3">
                <ExcelIcon className="w-6 h-6 text-primary" />
                <div>
                  <div className="text-[13px] text-cream font-semibold truncate max-w-md">{uploadedFile.name}</div>
                  <div className="text-[10px] text-hint font-mono">{(uploadedFile.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
              <button
                onClick={handleCancelImport}
                className="text-danger hover:text-danger/80 transition-colors p-1.5 hover:bg-elevated rounded border border-transparent hover:border-border select-none cursor-pointer"
              >
                <Trash className="w-4 h-4" />
              </button>
            </div>

            {parsing && (
              <div className="flex items-center justify-center py-10 gap-3 select-none">
                <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                <span className="text-[13px] text-cream font-bold">Parsing Excel Workbooks...</span>
              </div>
            )}

            {parsedData && (
              <div className="space-y-6">
                {/* Parse Summary Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 select-none">
                  <div className="bg-background border border-border rounded p-4 text-center">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans block mb-1">Buy Lots</span>
                    <span className="text-[16px] font-bold font-mono text-primary">{parsedData.buys.length}</span>
                  </div>
                  <div className="bg-background border border-border rounded p-4 text-center">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans block mb-1">Sell Lots</span>
                    <span className="text-[16px] font-bold font-mono text-primary">{parsedData.sells.length}</span>
                  </div>
                  <div className="bg-background border border-border rounded p-4 text-center">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans block mb-1">Mutual Funds</span>
                    <span className="text-[16px] font-bold font-mono text-primary">{parsedData.funds.length}</span>
                  </div>
                  <div className="bg-background border border-border rounded p-4 text-center">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans block mb-1">Alternatives</span>
                    <span className="text-[16px] font-bold font-mono text-primary">{parsedData.alternatives.length}</span>
                  </div>
                </div>

                {/* Validation Warnings / Error Log */}
                {parsedData.errors.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/40 text-danger rounded select-none">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <span className="text-[13px] font-semibold">Detected {parsedData.errors.length} data validation errors. Non-conforming rows will be skipped.</span>
                    </div>

                    <div className="border border-border bg-[#0A0A0F] rounded max-h-48 overflow-y-auto divide-y divide-border/40 select-text">
                      {parsedData.errors.map((err, idx) => (
                        <div key={idx} className="p-3 text-[12px] flex items-start gap-4">
                          <span className="px-2 py-0.5 rounded bg-danger/15 text-danger font-mono font-bold text-[10px] shrink-0">
                            {err.sheet} (Row {err.row})
                          </span>
                          <div className="flex-1">
                            <span className="text-cream font-semibold">{err.field}:</span>{' '}
                            <span className="text-muted">{err.message}</span>
                          </div>
                          <span className="text-[11px] text-hint font-mono shrink-0">Value: "{String(err.rawValue)}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-4 bg-success/10 border border-success/40 text-success rounded select-none">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <span className="text-[13px] font-semibold">Spreadsheet validation complete: 0 errors detected. File is clean.</span>
                  </div>
                )}

                {/* Action controls */}
                <div className="flex items-center justify-end gap-3 select-none pt-4 border-t border-border/40">
                  <button
                    onClick={handleCancelImport}
                    className="px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] rounded text-cream text-[13px] font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={
                      parsedData.buys.length === 0 &&
                      parsedData.sells.length === 0 &&
                      parsedData.funds.length === 0 &&
                      parsedData.alternatives.length === 0 &&
                      parsedData.cash.length === 0
                    }
                    className="px-5 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[13px] font-bold uppercase tracking-wider transition-colors shadow-lg disabled:opacity-40 cursor-pointer"
                  >
                    Merge into Database
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default ImportExport;
