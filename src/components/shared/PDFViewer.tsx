import React, { useMemo } from 'react';
import { X, Download, FileText } from 'lucide-react';

interface PDFViewerProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBase64: string; // The base64 string of the document
  fileName: string;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ isOpen, onClose, pdfBase64, fileName }) => {
  const blobUrl = useMemo(() => {
    if (!pdfBase64 || !isOpen) return null;

    try {
      // Clean base64 string headers
      const pureBase64 = pdfBase64.includes(';base64,') 
        ? pdfBase64.split(';base64,')[1] 
        : pdfBase64;
        
      const byteCharacters = atob(pureBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Failed to translate base64 string to PDF Blob', err);
      return null;
    }
  }, [pdfBase64, isOpen]);

  // Clean up Blob URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName || 'TRCapital_Note.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-50 p-6 select-none animate-fade-in">
      <div className="w-full h-full max-w-5xl bg-surface border border-border rounded flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="h-14 bg-elevated border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-cream">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-sans text-[13px] font-semibold tracking-wide truncate max-w-md">
              {fileName || 'Document Viewer'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-elevated border border-border hover:border-primary/60 rounded text-cream hover:text-primary transition-all font-sans text-[12px] font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-elevated rounded border border-transparent hover:border-border text-muted hover:text-cream transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Frame */}
        <div className="flex-1 w-full bg-[#0A0A0F] relative p-4 select-text">
          {blobUrl ? (
            <iframe
              src={`${blobUrl}#toolbar=1&navpanes=0`}
              title={fileName}
              className="w-full h-full border-0 rounded bg-[#0A0A0F]"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none text-muted">
              <AlertWarningIcon className="w-8 h-8 text-danger" />
              <span className="font-sans text-[13px] font-semibold text-danger">Failed to load PDF</span>
              <span className="font-sans text-[11px] text-hint">The file content might be corrupt or incomplete.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Internal icon wrapper
const AlertWarningIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor" 
    {...props}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

export default PDFViewer;
