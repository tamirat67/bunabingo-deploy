"use client";

import React from 'react';
import { FiDownload } from 'react-icons/fi';

export function PdfExportButton({ 
  targetElementId = "printable-area", 
  filename = "Report",
  title = "Export to PDF"
}: { 
  targetElementId?: string, 
  filename?: string,
  title?: string 
}) {
  const handlePrint = () => {
    // In a real app we'd inject print styles globally, but window.print() handles it
    // if the CSS has @media print defined properly.
    document.title = filename; // Sets default save name
    window.print();
    document.title = "Buna Bingo Admin";
  };

  return (
    <button
      onClick={handlePrint}
      className="pdf-export-btn"
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.08)',
        background: '#ffffff',
        cursor: 'pointer',
        fontWeight: '700',
        color: '#3d2b1f',
        fontSize: '13px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#f9fafb';
        e.currentTarget.style.borderColor = '#d4af37';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#ffffff';
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)';
      }}
    >
      <FiDownload size={16} color="#d4af37" />
      <span>{title}</span>
    </button>
  );
}
