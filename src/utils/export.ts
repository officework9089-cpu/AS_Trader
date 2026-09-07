/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from "jspdf";
import autoTable, { UserOptions } from "jspdf-autotable";
import { CustomerOrder } from "../types";

// Type definition for jsPDF instances with autoTable extensions
interface jsPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

/**
 * Exports order data to a CSV file.
 * Uses UTF-8 BOM and Blob objects for standard RFC 4180 compatibility.
 */
export function exportToCSV(orders: CustomerOrder[], filename = "ascomm_statement.csv"): void {
  const headers = [
    "Product Name",
    "Unit Price ($)",
    "Unit Weight (kg)",
    "Quantity",
    "Total Weight (kg)",
    "Line Total ($)",
    "Paid Amount ($)",
    "Remaining Balance ($)",
    "Last Updated",
  ];

  const rows = orders.map((o) => [
    `"${o.product_name.replace(/"/g, '""')}"`,
    o.unit_price.toFixed(2),
    o.weight.toFixed(3),
    o.qty.toString(),
    o.total_weight.toFixed(2),
    o.line_total.toFixed(2),
    o.paid_amount.toFixed(2),
    o.remaining_amount.toFixed(2),
    o.updated_at ? o.updated_at.split("T")[0] : "",
  ]);

  // Insert UTF-8 BOM (\uFEFF) to guarantee Excel reads special characters properly
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports order data and financial totals to a PDF document.
 */
export function exportToPDF(
  customerName: string,
  orders: CustomerOrder[],
  totalAmount: number,
  totalPaid: number,
  totalRemaining: number
): void {
  const doc = new jsPDF() as jsPDFWithAutoTable;

  // Header Title Block (Navy Accent #0A192F)
  doc.setFillColor(10, 25, 47);
  doc.rect(0, 0, 210, 40, "F");

  // Title Text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("ASComm", 15, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 210, 255); // Cyan
  doc.text("PRODUCT LISTINGS & CALCULATIONS STATEMENT", 15, 28);

  // Statement Meta Text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`Statement Date: ${new Date().toISOString().split("T")[0]}`, 140, 20);
  doc.text("System: Automated Calculations", 140, 26);

  // Customer Profile Header Block
  doc.setTextColor(10, 25, 47);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PREPARED FOR:", 15, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(23, 42, 69);
  doc.text(customerName, 15, 60);

  doc.setFontSize(9);
  doc.setTextColor(115, 115, 115);
  doc.text(
    "This statement reflects active itemized product metrics, total weights, sourcing values, and outstanding balances.",
    15,
    66
  );

  // Table Data Mapping
  const tableData = orders.map((o) => [
    o.product_name,
    `$${o.unit_price.toFixed(2)}`,
    `${o.weight.toFixed(3)} kg`,
    o.qty.toString(),
    `${o.total_weight.toFixed(2)} kg`,
    `$${o.line_total.toFixed(2)}`,
    `$${o.paid_amount.toFixed(2)}`,
    `$${o.remaining_amount.toFixed(2)}`,
  ]);

  // AutoTable Options
  const autoTableOptions: UserOptions = {
    startY: 75,
    head: [
      [
        "Product Name",
        "Unit Price",
        "Unit Weight",
        "Qty",
        "Total Weight",
        "Line Total",
        "Paid Amt",
        "Remaining",
      ],
    ],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [10, 25, 47],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "left",
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right", fontStyle: "bold", textColor: [190, 24, 74] }, // Rose for remaining balance
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  };

  // Render Table via direct function call
  autoTable(doc, autoTableOptions);

  let finalY = doc.lastAutoTable.finalY + 12;

  // Handle page overflow if summary card exceeds available height
  const pageHeight = doc.internal.pageSize.height;
  if (finalY + 60 > pageHeight) {
    doc.addPage();
    finalY = 20;
  }

  // Outstanding Summary Cards Block (Lower right)
  doc.setFillColor(241, 245, 249);
  doc.rect(115, finalY, 80, 42, "F");
  doc.setDrawColor(10, 25, 47);
  doc.line(115, finalY, 195, finalY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text("Aggregate Statement Totals:", 120, finalY + 8);

  doc.text("Total Line Cost:", 120, finalY + 18);
  doc.text("Total Paid:", 120, finalY + 26);

  doc.setFont("helvetica", "bold");
  doc.text(`$${totalAmount.toFixed(2)}`, 165, finalY + 18);
  doc.text(`$${totalPaid.toFixed(2)}`, 165, finalY + 26);

  // Remaining Balance Highlights
  doc.setTextColor(190, 24, 74); // Rose
  doc.text("Outstanding Balance:", 120, finalY + 34);
  doc.text(`$${totalRemaining.toFixed(2)}`, 165, finalY + 34);

  // Footer / Terms
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("If you have any questions about this statement, please contact the ASComm Admin desk.", 15, finalY + 52);
  doc.text("Thank you for your business!", 15, finalY + 57);

  const safeCustomerName = customerName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  doc.save(`ASComm_Invoice_Statement_${safeCustomerName}.pdf`);
}