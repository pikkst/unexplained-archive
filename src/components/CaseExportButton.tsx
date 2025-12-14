import React, { useState } from 'react';
import { Download, FileText, FileJson, File } from 'lucide-react';
import { exportCaseService } from '../services/exportCaseService';

interface CaseExportButtonProps {
  caseData: any;
}

export const CaseExportButton: React.FC<CaseExportButtonProps> = ({ caseData }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'pdf' | 'json' | 'text') => {
    try {
      setExporting(true);
      setShowMenu(false);

      if (format === 'pdf') {
        await exportCaseService.exportToPDF(caseData);
        alert('✅ PDF exported successfully!');
      } else if (format === 'json') {
        exportCaseService.exportToJSON(caseData);
        alert('✅ JSON exported successfully!');
      } else if (format === 'text') {
        exportCaseService.exportToText(caseData);
        alert('✅ Text file exported successfully!');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export case');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="relative bg-mystery-900/50 border border-mystery-600 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-green-400" />
          <div>
            <h4 className="text-white font-bold text-sm">Export Case</h4>
            <p className="text-xs text-gray-400">Download report</p>
          </div>
        </div>
        <button
          onClick={() => setShowMenu(!showMenu)}
          disabled={exporting}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          {exporting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export
            </>
          )}
        </button>
      </div>

      {/* Dropdown Menu */}
      {showMenu && (
        <div className="absolute right-4 top-full mt-2 bg-mystery-800 border border-mystery-700 rounded-lg shadow-xl z-50 min-w-[180px]">
          <button
            onClick={() => handleExport('pdf')}
            className="w-full px-4 py-3 text-left hover:bg-mystery-700 transition-colors flex items-center gap-3 text-white"
          >
            <FileText className="w-4 h-4 text-red-400" />
            <div>
              <div className="font-medium">PDF</div>
              <div className="text-xs text-gray-400">Full report</div>
            </div>
          </button>
          <button
            onClick={() => handleExport('json')}
            className="w-full px-4 py-3 text-left hover:bg-mystery-700 transition-colors flex items-center gap-3 text-white border-t border-mystery-700"
          >
            <FileJson className="w-4 h-4 text-blue-400" />
            <div>
              <div className="font-medium">JSON</div>
              <div className="text-xs text-gray-400">Structured data</div>
            </div>
          </button>
          <button
            onClick={() => handleExport('text')}
            className="w-full px-4 py-3 text-left hover:bg-mystery-700 transition-colors flex items-center gap-3 text-white border-t border-mystery-700 rounded-b-lg"
          >
            <File className="w-4 h-4 text-green-400" />
            <div>
              <div className="font-medium">Text</div>
              <div className="text-xs text-gray-400">Plain text</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
