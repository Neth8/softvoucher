/**
 * SoftCreation Voucher System
 * Voucher Form & Submission Controller
 */

let attachedFiles = []; // Holds { fileObject, previewUrl, existingUrl, name, isPdf }
let editModeVoucherNo = null;

const VOUCHER_CONTROLLER = {
    init() {
        this.populateDropdowns();
        this.bindEvents();
        this.resetForm();
    },

    populateDropdowns() {
        const bankSelect = document.getElementById("formBank");
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="" selected disabled>Select Bank Account...</option>' +
                CONFIG.BANKS.map(b => `<option value="${b}">${b}</option>`).join("");
        }

        const typeSelect = document.getElementById("formType");
        if (typeSelect) {
            typeSelect.innerHTML = CONFIG.EXPENSE_TYPES.map(t => `<option value="${t}">${t}</option>`).join("");
        }
    },

    bindEvents() {
        const dateInput = document.getElementById("formDate");
        if (dateInput) {
            dateInput.addEventListener("change", () => this.handleDateChange());
        }

        const typeSelect = document.getElementById("formType");
        if (typeSelect) {
            typeSelect.addEventListener("change", () => this.handleTypeChange());
        }

        const fileInput = document.getElementById("fileInput");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => this.handleFilesAdded(e.target.files));
        }

        const submitBtn = document.getElementById("btnSubmitVoucher");
        if (submitBtn) {
            submitBtn.addEventListener("click", () => this.handleSubmit());
        }

        const resetBtn = document.getElementById("btnResetForm");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => this.resetForm());
        }
    },

    async handleDateChange() {
        const dateVal = document.getElementById("formDate").value;
        const display = document.getElementById("formVoucherNo");
        if (!dateVal) {
            display.value = "Select date first...";
            return;
        }

        if (editModeVoucherNo) {
            // In edit mode, retain or adapt
            return;
        }

        display.value = "Calculating sequence...";
        try {
            const { voucherNo } = await dbGetNextSequence(dateVal);
            display.value = voucherNo;
        } catch (err) {
            console.error("Sequence error:", err);
            display.value = "Error generating sequence";
        }
    },

    handleTypeChange() {
        const type = document.getElementById("formType").value;
        const empContainer = document.getElementById("empNoContainer");
        const otherContainer = document.getElementById("otherTypeContainer");

        if (empContainer) {
            empContainer.classList.toggle("d-none", type !== "Salary" && type !== "Commission");
        }
        if (otherContainer) {
            otherContainer.classList.toggle("d-none", type !== "Other");
        }
    },

    handleFilesAdded(fileList) {
        if (!fileList || fileList.length === 0) return;

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i];
            const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
            const previewUrl = isPdf ? null : URL.createObjectURL(file);

            attachedFiles.push({
                fileObject: file,
                previewUrl: previewUrl,
                existingUrl: null,
                name: file.name,
                isPdf: isPdf
            });
        }

        this.renderFilePreviews();
        // Clear file input
        document.getElementById("fileInput").value = "";
    },

    removeFile(index) {
        if (attachedFiles[index] && attachedFiles[index].previewUrl) {
            URL.revokeObjectURL(attachedFiles[index].previewUrl);
        }
        attachedFiles.splice(index, 1);
        this.renderFilePreviews();
    },

    renderFilePreviews() {
        const container = document.getElementById("filePreviewArea");
        if (!container) return;

        let html = `
            <div class="upload-trigger-box" onclick="document.getElementById('fileInput').click()" title="Attach Receipt / Bill">
                <i class="bi bi-cloud-arrow-up fs-3"></i>
                <span class="small mt-1">Add Bill</span>
            </div>
        `;

        attachedFiles.forEach((file, index) => {
            if (file.isPdf) {
                html += `
                    <div class="file-preview-card pdf-card">
                        <i class="bi bi-file-earmark-pdf-fill text-danger fs-2"></i>
                        <span class="file-name" title="${file.name}">${file.name}</span>
                        <button type="button" class="btn-remove-file" onclick="VOUCHER_CONTROLLER.removeFile(${index})" title="Remove">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `;
            } else {
                const src = file.previewUrl || file.existingUrl;
                html += `
                    <div class="file-preview-card">
                        <img src="${src}" alt="Receipt">
                        <span class="file-name" title="${file.name}">${file.name}</span>
                        <button type="button" class="btn-remove-file" onclick="VOUCHER_CONTROLLER.removeFile(${index})" title="Remove">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `;
            }
        });

        container.innerHTML = html;
    },

    resetForm() {
        editModeVoucherNo = null;
        attachedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
        attachedFiles = [];

        document.getElementById("formDate").value = new Date().toISOString().slice(0, 10);
        document.getElementById("formBank").value = "";
        document.getElementById("formType").value = "Food";
        document.getElementById("formAmount").value = "";
        document.getElementById("formNote").value = "";
        document.getElementById("formEmpNo").value = "";
        document.getElementById("formOtherType").value = "";

        document.getElementById("formTitle").innerText = "🧾 Submit Payment Voucher";
        document.getElementById("btnSubmitVoucher").innerText = "Submit for Approval";
        document.getElementById("btnCancelEdit").classList.add("d-none");

        this.handleTypeChange();
        this.handleDateChange();
        this.renderFilePreviews();
    },

    async enterEditMode(voucher) {
        if (!voucher) return;
        editModeVoucherNo = voucher.voucherNo;

        document.getElementById("formVoucherNo").value = voucher.voucherNo;
        document.getElementById("formDate").value = voucher.date;
        document.getElementById("formBank").value = voucher.bank;

        const isStandardType = CONFIG.EXPENSE_TYPES.includes(voucher.type);
        if (isStandardType) {
            document.getElementById("formType").value = voucher.type;
        } else {
            document.getElementById("formType").value = "Other";
            document.getElementById("formOtherType").value = voucher.type;
        }

        document.getElementById("formAmount").value = voucher.amount;
        document.getElementById("formNote").value = voucher.note;
        document.getElementById("formEmpNo").value = voucher.employeeNo || "";

        this.handleTypeChange();

        // Load existing bill attachments
        attachedFiles = [];
        const existingUrls = STORAGE_SERVICE.parseBillUrls(voucher.billUrl);
        existingUrls.forEach((url, i) => {
            const isPdf = STORAGE_SERVICE.isPdfUrl(url);
            attachedFiles.push({
                fileObject: null,
                previewUrl: null,
                existingUrl: url,
                name: `Attachment ${i + 1}`,
                isPdf: isPdf
            });
        });
        this.renderFilePreviews();

        document.getElementById("formTitle").innerText = `✏️ Edit Voucher #${voucher.voucherNo}`;
        document.getElementById("btnSubmitVoucher").innerText = "Update & Resubmit Voucher";
        document.getElementById("btnCancelEdit").classList.remove("d-none");

        APP.switchTab("tab-voucher-form");
    },

    async handleSubmit() {
        const user = APP.getCurrentUser();
        if (!user) {
            APP.showToast("Please log in first.", "danger");
            return;
        }

        const date = document.getElementById("formDate").value;
        const bank = document.getElementById("formBank").value;
        let type = document.getElementById("formType").value;
        const amount = document.getElementById("formAmount").value;
        const note = document.getElementById("formNote").value;
        const employeeNo = document.getElementById("formEmpNo").value;
        const otherType = document.getElementById("formOtherType").value;

        if (type === "Other" && otherType.trim()) {
            type = otherType.trim();
        }

        // Validations
        if (!date) return APP.showToast("Please select a date.", "warning");
        if (!bank) return APP.showToast("Please select a bank account.", "warning");
        if (!amount || Number(amount) <= 0) return APP.showToast("Please enter a valid amount.", "warning");
        if ((type === "Salary" || type === "Commission") && !employeeNo.trim()) {
            return APP.showToast(`Employee No is required for ${type} payments.`, "warning");
        }

        const submitBtn = document.getElementById("btnSubmitVoucher");
        submitBtn.disabled = true;

        try {
            APP.showLoader(attachedFiles.some(f => f.fileObject) ? "Uploading Bills to Cloud Storage..." : "Saving Voucher...");

            let targetVoucherNo = editModeVoucherNo;
            if (!targetVoucherNo) {
                const seq = await dbGetNextSequence(date);
                targetVoucherNo = seq.voucherNo;
            }

            // 1. Upload new files to Supabase Storage
            const uploadedUrls = await STORAGE_SERVICE.uploadFiles(attachedFiles, targetVoucherNo);
            const billUrlString = uploadedUrls.length > 0 ? uploadedUrls.join(",") : "No Bill";

            const payload = {
                date: date,
                bank: bank,
                type: type,
                amount: Number(amount),
                note: note,
                employeeNo: employeeNo.trim(),
                billUrl: billUrlString
            };

            if (editModeVoucherNo) {
                await dbUpdateVoucher(editModeVoucherNo, payload, user);
                APP.showToast(`✅ Voucher #${editModeVoucherNo} updated and resubmitted!`, "success");
            } else {
                const newRec = await dbCreateVoucher(payload, user);
                APP.showToast(`✅ Voucher #${newRec.voucherNo} created successfully!`, "success");
            }

            this.resetForm();
            APP.hideLoader();

            // Refresh ledger & approvals
            if (window.LEDGER_CONTROLLER) LEDGER_CONTROLLER.fetchData(1);
            if (window.APPROVALS_CONTROLLER) APPROVALS_CONTROLLER.fetchPending();
            
            APP.switchTab("tab-ledger");
        } catch (err) {
            APP.hideLoader();
            console.error("Submit error:", err);
            APP.showToast(err.message, "danger");
        } finally {
            submitBtn.disabled = false;
        }
    }
};

