import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: string;
  isNumeric?: boolean;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  actions?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  actions,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Handle column sorting
  const handleSort = (key: string, sortable = true) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Filter by search term
    if (searchTerm.trim() && searchKeys.length > 0) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((row) =>
        searchKeys.some((key) => {
          const val = row[key];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(term);
        })
      );
    }

    // Sort
    if (sortKey) {
      filtered.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // Handle case-insensitive sorting for strings
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, searchKeys, sortKey, sortDirection]);

  return (
    <div className="flex flex-col h-full w-full select-text">
      {/* Table controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 select-none">
        {searchKeys.length > 0 ? (
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded text-cream placeholder-hint text-[13px] font-sans focus:border-primary transition-colors duration-150"
            />
          </div>
        ) : (
          <div></div>
        )}
        
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Structured data table container */}
      <div className="flex-1 w-full overflow-x-auto rounded border border-border bg-[#0A0A0F]">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key, col.sortable !== false)}
                  className={`py-3 px-4 text-[#E8DCC8] font-sans font-semibold tracking-wider uppercase text-[11px] border-b border-border
                    ${col.sortable !== false ? 'cursor-pointer hover:text-primary transition-colors' : ''}
                    ${col.isNumeric ? 'text-right' : 'text-left'}`}
                >
                  <div className={`flex items-center gap-1.5 ${col.isNumeric ? 'justify-end' : 'justify-start'}`}>
                    <span>{col.label}</span>
                    {col.sortable !== false && sortKey === col.key && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-sans">
            {processedData.length > 0 ? (
              processedData.map((row, rIdx) => (
                <tr
                  key={row.transactionId || row.id || rIdx}
                  className={`border-l-2 border-l-transparent hover:border-l-primary hover:bg-[#1E1E2E] transition-all
                    ${rIdx % 2 === 0 ? 'bg-[#12121A]' : 'bg-[#0F0F18]'}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 px-4 text-cream font-sans leading-normal
                        ${col.isNumeric ? 'text-right font-mono text-[12px]' : ''}`}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-[#505065]">
                  <div className="flex flex-col items-center gap-2 select-none">
                    <span className="text-[14px] font-sans font-semibold">No records found</span>
                    <span className="text-[12px] text-hint font-sans">Try expanding your search query or add a new entry.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
