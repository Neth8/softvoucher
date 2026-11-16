/**
 * SoftCreation Voucher System
 * Reports & Data Export Service (Client-Side PDF & CSV)
 */

const REPORT_SERVICE = {
    /**
     * Generate branded Monthly Expense PDF report using jsPDF & autoTable
     */
    async generateMonthlyReport(monthStr) {
        if (!monthStr) throw new Error("Please select a month first.");

        // Fetch approved records directly from Supabase
        const records = await dbGetMonthlyApprovedVouchers(monthStr);

        if (!records || records.length === 0) {
            throw new Error(`No approved vouchers found for ${monthStr}.`);
        }

        // Verify jsPDF availability
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) {
            throw new Error("jsPDF library is not loaded. Please ensure an active internet connection.");
        }

        const doc = new jsPDF("p", "pt", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();

        // 1. Header & Branding
        doc.setFillColor(15, 23, 42); // #0f172a
        doc.rect(0, 0, pageWidth, 80, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(0, 210, 106); // #00d26a
        doc.text("SoftCreation (Pvt) Ltd.", 40, 42);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // #94a3b8
        doc.text("Business Operations & Finance System", 40, 60);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        doc.text("EXPENSE REPORT", pageWidth - 40, 42, { align: "right" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Period: ${monthStr}`, pageWidth - 40, 60, { align: "right" });

        // 2. Metadata details
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(9);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 105);
        doc.text(`Total Approved Records: ${records.length}`, pageWidth - 40, 105, { align: "right" });

        // 3. Prepare table rows
        let grandTotal = 0;
        const tableBody = records.map((rec, index) => {
            const amt = Number(rec.amount || 0);
            grandTotal += amt;
            return [
                index + 1,
                rec.date,
                rec.voucherNo,
                rec.type,
                rec.bank,
                amt.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
        });

        // Add Grand Total Row
        tableBody.push([
            "",
            "",
            "",
            "",
            "GRAND TOTAL",
            `LKR ${grandTotal.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ]);

        // 4. Render Table
        doc.autoTable({
            startY: 120,
            head: [["#", "Date", "Voucher No", "Type", "Bank Account", "Amount (Rs.)"]],
            body: tableBody,
            theme: "grid",
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                fontStyle: "bold",
                fontSize: 9,
                halign: "left"
            },
            styles: {
                fontSize: 8.5,
                cellPadding: 6,
                textColor: [15, 23, 42],
                lineColor: [226, 232, 240]
            },
            columnStyles: {
                0: { cellWidth: 25, halign: "center" },
                1: { cellWidth: 70 },
                2: { cellWidth: 80, fontStyle: "bold" },
                3: { cellWidth: 80 },
                4: { cellWidth: "auto" },
                5: { cellWidth: 95, halign: "right", fontStyle: "bold" }
            },
            didParseCell: function (data) {
                // Highlight Grand Total Row
                if (data.row.index === tableBody.length - 1) {
                    data.cell.styles.fontStyle = "bold";
                    if (data.column.index === 4) {
                        data.cell.styles.halign = "right";
                    }
                    if (data.column.index === 5) {
                        data.cell.styles.fillColor = [220, 252, 231]; // light green #dcfce7
                        data.cell.styles.textColor = [22, 101, 52];
                    }
                }
            },
            margin: { left: 40, right: 40, bottom: 60 }
        });

        // 5. Footer & Disclaimer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageH = doc.internal.pageSize.getHeight();
            doc.setDrawColor(226, 232, 240);
            doc.line(40, pageH - 40, pageWidth - 40, pageH - 40);

            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("SoftCreation (Pvt) Ltd. • Confidential Financial Document", 40, pageH - 25);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, pageH - 25, { align: "right" });
        }

        // Save & initiate browser download
        const filename = `SoftCreation_Expense_Report_${monthStr}.pdf`;
        doc.save(filename);
        return filename;
    },

    /**
     * Export all vouchers to CSV
     */
    async exportCsvBackup() {
        const records = await dbExportAllVouchers();
        if (!records || records.length === 0) {
            throw new Error("No vouchers found in database to export.");
        }

        const headers = [
            "ID",
            "Voucher No",
            "Date",
            "Expense Type",
            "Bank / Payment Method",
            "Amount (LKR)",
            "Description Note",
            "Status",
            "Submitted By",
            "Employee No",
            "Approved By",
            "Approved Time",
            "Bill Attachments"
        ];

        const escapeCsv = (str) => {
            if (str === null || str === undefined) return '""';
            const s = String(str).replace(/"/g, '""');
            return `"${s}"`;
        };

        const rows = records.map(r => [
            r.id,
            escapeCsv(r.voucherNo),
            escapeCsv(r.date),
            escapeCsv(r.type),
            escapeCsv(r.bank),
            r.amount,
            escapeCsv(r.note),
            escapeCsv(r.status),
            escapeCsv(r.userEmail),
            escapeCsv(r.employeeNo),
            escapeCsv(r.approvedBy),
            escapeCsv(r.approvedTime),
            escapeCsv(r.billUrl)
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `SoftCreation_Vouchers_Backup_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};

