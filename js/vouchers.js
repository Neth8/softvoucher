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
        if (bankSelect && bankSelect.options.length <= 1) {
            bankSelect.innerHTML = '<option value="" selected disabled>Select Bank Account...</option>' +
                CONFIG.BANKS.map(b => `<option value="${b}">${b}</option>`).join("");
        }

        const typeSelect = document.getElementById("formType");
        if (typeSelect && typeSelect.options.length === 0) {
            typeSelect.innerHTML = CONFIG.EXPENSE_TYPES.map(t => `<option value="${t}">${t}</option>`).join("");
        }
    },

    bindEvents() {
        const dateInput = document.getElementById("formDate");
        if (dateInput) {
            dateInput.addEventListener("change", () => this.handleDateChange());
            dateInput.addEventListener("input", () => this.handleDateChange());
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

        // Drag and drop attachment area
        const dropArea = document.getElementById("filePreviewArea");
        if (dropArea) {
            dropArea.addEventListener("dragover", (e) => {
                e.preventDefault();
                dropArea.classList.add("drag-over");
            });
            dropArea.addEventListener("dragleave", () => {
                dropArea.classList.remove("drag-over");
            });
            dropArea.addEventListener("drop", (e) => {
                e.preventDefault();
                dropArea.classList.remove("drag-over");
                if (e.dataTransfer && e.dataTransfer.files) {
                    this.handleFilesAdded(e.dataTransfer.files);
                }
            });
        }
    },

    async handleDateChange() {
        const dateVal = document.getElementById("formDate")?.value;
        const display = document.getElementById("formVoucherNo");
        if (!display) return;

        if (!dateVal) {
            display.value = "Select date first...";
            return;
        }

        if (editModeVoucherNo) {
            display.value = editModeVoucherNo;
            return;
        }

        display.value = "Calculating sequence...";
        try {
            const { voucherNo } = await dbGetNextSequence(dateVal);
            display.value = voucherNo;
        } catch (err) {
            console.warn("Sequence calculation warning:", err);
            // Fallback generation (YYYYMM01) if table is fresh or offline
            const parts = dateVal.split("-");
            const fallbackNo = `${parts[0]}${parts[1]}01`;
            display.value = fallbackNo;
        }
    },

    handleTypeChange() {
        const typeEl = document.getElementById("formType");
        if (!typeEl) return;
        const type = typeEl.value;
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
            // Object URL for both image and PDF preview
            const previewUrl = URL.createObjectURL(file);

            attachedFiles.push({
                fileObject: file,
                previewUrl: previewUrl,
                existingUrl: null,
                name: file.name,
                isPdf: isPdf
            });
        }

        this.renderFilePreviews();
        const fileInput = document.getElementById("fileInput");
        if (fileInput) fileInput.value = "";
    },

    removeFile(index) {
        if (attachedFiles[index] && attachedFiles[index].previewUrl) {
            URL.revokeObjectURL(attachedFiles[index].previewUrl);
        }
        attachedFiles.splice(index, 1);
        this.renderFilePreviews();
    },

    previewAttachedItem(index) {
        const item = attachedFiles[index];
        if (!item) return;
        const url = item.previewUrl || item.existingUrl;
        if (url && window.APP) {
            APP.openMediaPreview(url);
        }
    },

    renderFilePreviews() {
        const container = document.getElementById("filePreviewArea");
        if (!container) return;

        let html = `
            <div class="upload-trigger-box shadow-sm" onclick="document.getElementById('fileInput').click()" title="Click to browse files or drop here">
                <i class="bi bi-cloud-arrow-up fs-2 text-primary"></i>
                <span class="small mt-1 fw-bold">Attach Bill</span>
            </div>
        `;

        attachedFiles.forEach((file, index) => {
            if (file.isPdf) {
                html += `
                    <div class="file-preview-card pdf-card shadow-sm" onclick="VOUCHER_CONTROLLER.previewAttachedItem(${index})" title="Click to preview PDF">
                        <i class="bi bi-file-earmark-pdf-fill text-danger fs-1"></i>
                        <span class="file-name" title="${file.name}">${file.name}</span>
                        <div class="preview-badge"><i class="bi bi-zoom-in"></i></div>
                        <button type="button" class="btn-remove-file" onclick="event.stopPropagation(); VOUCHER_CONTROLLER.removeFile(${index})" title="Remove">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                `;
            } else {
                const src = file.previewUrl || file.existingUrl;
                html += `
                    <div class="file-preview-card shadow-sm" onclick="VOUCHER_CONTROLLER.previewAttachedItem(${index})" title="Click to preview Image">
                        <img src="${src}" alt="Receipt">
                        <span class="file-name" title="${file.name}">${file.name}</span>
                        <div class="preview-badge"><i class="bi bi-zoom-in"></i></div>
                        <button type="button" class="btn-remove-file" onclick="event.stopPropagation(); VOUCHER_CONTROLLER.removeFile(${index})" title="Remove">
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

        const dateInput = document.getElementById("formDate");
        if (dateInput) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }

        const bankInput = document.getElementById("formBank");
        if (bankInput) bankInput.value = "";

        const typeInput = document.getElementById("formType");
        if (typeInput) typeInput.value = "Food";

        const amountInput = document.getElementById("formAmount");
        if (amountInput) amountInput.value = "";

        const noteInput = document.getElementById("formNote");
        if (noteInput) noteInput.value = "";

        const empInput = document.getElementById("formEmpNo");
        if (empInput) empInput.value = "";

        const otherInput = document.getElementById("formOtherType");
        if (otherInput) otherInput.value = "";

        const titleEl = document.getElementById("formTitle");
        if (titleEl) titleEl.innerText = "🧾 Submit Payment Voucher";

        const btnSubmit = document.getElementById("btnSubmitVoucher");
        if (btnSubmit) btnSubmit.innerText = "Submit for Approval";

        const btnCancel = document.getElementById("btnCancelEdit");
        if (btnCancel) btnCancel.classList.add("d-none");

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

        if (window.APP) APP.switchTab("tab-voucher-form");
    },

    async handleSubmit() {
        const user = window.APP ? APP.getCurrentUser() : null;
        if (!user) {
            if (window.APP) APP.showToast("Please log in first.", "danger");
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

// Bind to window for global access
window.VOUCHER_CONTROLLER = VOUCHER_CONTROLLER;

// Auto-init when DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => VOUCHER_CONTROLLER.init());
} else {
    VOUCHER_CONTROLLER.init();
}
