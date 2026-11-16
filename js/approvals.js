/**
 * SoftCreation Voucher System
 * Approvals Hub Controller (For Authorized Approvers)
 */

const APPROVALS_CONTROLLER = {
    pendingVouchers: [],
    selectedVouchers: new Set(),
    activeRejectVoucherNo: null,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const selectAllCb = document.getElementById("selectAllApprovals");
        if (selectAllCb) {
            selectAllCb.addEventListener("change", (e) => {
                const checked = e.target.checked;
                this.pendingVouchers.forEach(v => {
                    if (checked) {
                        this.selectedVouchers.add(v.voucherNo);
                    } else {
                        this.selectedVouchers.delete(v.voucherNo);
                    }
                });
                this.updateSelectionUI();
            });
        }

        const bulkApproveBtn = document.getElementById("btnBulkApprove");
        if (bulkApproveBtn) {
            bulkApproveBtn.addEventListener("click", () => this.handleBulkApprove());
        }

        const confirmRejectBtn = document.getElementById("btnConfirmReject");
        if (confirmRejectBtn) {
            confirmRejectBtn.addEventListener("click", () => this.handleConfirmReject());
        }
    },

    async fetchPending() {
        const user = APP.getCurrentUser();
        if (!user || !canUserApprove(user)) return;

        const container = document.getElementById("approvalsList");
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                    Checking for pending vouchers...
                </div>
            `;
        }

        this.selectedVouchers.clear();
        this.updateSelectionUI();

        try {
            const res = await dbGetVouchersPaginated({
                status: "PENDING",
                pageSize: 100, // Fetch top 100 pending
                orderBy: "id",
                orderAsc: false
            });

            this.pendingVouchers = res.records;
            this.renderList();

            // Update badge in sidebar
            const badge = document.getElementById("badgePendingApprovals");
            if (badge) {
                badge.innerText = this.pendingVouchers.length;
                badge.classList.toggle("d-none", this.pendingVouchers.length === 0);
            }
        } catch (err) {
            console.error("Approvals fetch error:", err);
            if (container) {
                container.innerHTML = `
                    <div class="col-12 text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> ${err.message}
                    </div>
                `;
            }
        }
    },

    renderList() {
        const container = document.getElementById("approvalsList");
        if (!container) return;

        if (this.pendingVouchers.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="display-6 text-success mb-2"><i class="bi bi-check2-all"></i></div>
                    <h5 class="fw-bold">All caught up!</h5>
                    <p class="text-muted">There are currently no vouchers pending your approval.</p>
                </div>
            `;
            return;
        }

        let html = "";
        this.pendingVouchers.forEach(v => {
            const billUrls = STORAGE_SERVICE.parseBillUrls(v.billUrl);
            const isChecked = this.selectedVouchers.has(v.voucherNo);

            let billPills = '<span class="text-muted small fst-italic">No bills attached</span>';
            if (billUrls.length > 0) {
                billPills = billUrls.map((url, i) => `
                    <a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary py-0 px-2 small">
                        <i class="bi bi-paperclip"></i> Bill ${i + 1}
                    </a>
                `).join(" ");
            }

            html += `
                <div class="col-12">
                    <div class="card card-custom p-3 approval-card ${isChecked ? 'border-primary' : ''}">
                        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div class="d-flex align-items-center gap-3">
                                <input type="checkbox" class="form-check-input fs-5 approval-item-checkbox" 
                                    data-voucher="${v.voucherNo}" ${isChecked ? 'checked' : ''}
                                    onchange="APPROVALS_CONTROLLER.toggleSelect('${v.voucherNo}', this.checked)">
                                <div>
                                    <div class="d-flex align-items-center gap-2">
                                        <span class="fw-bold fs-5 text-primary font-monospace">${v.voucherNo}</span>
                                        <span class="badge bg-secondary bg-opacity-25 text-body">${v.type}</span>
                                        <span class="small text-muted"><i class="bi bi-calendar3"></i> ${v.date}</span>
                                    </div>
                                    <div class="small text-muted mt-1">
                                        <span><b>Bank:</b> ${v.bank}</span> &bull; 
                                        <span><b>User:</b> ${v.userEmail}</span>
                                        ${v.employeeNo ? ` &bull; <span><b>Emp No:</b> ${v.employeeNo}</span>` : ''}
                                    </div>
                                    ${v.note ? `<div class="small mt-1 text-secondary fst-italic">"${v.note}"</div>` : ''}
                                </div>
                            </div>

                            <div class="d-flex flex-column align-items-end">
                                <div class="fs-4 fw-bold text-success mb-2">
                                    Rs. ${v.amount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    ${billPills}
                                    <button class="btn btn-sm btn-outline-primary" onclick="APP.viewVoucher('${v.voucherNo}')" title="View Full Voucher">
                                        <i class="bi bi-eye"></i> View
                                    </button>
                                    <button class="btn btn-sm btn-danger px-3 fw-bold" onclick="APPROVALS_CONTROLLER.openRejectModal('${v.voucherNo}')">
                                        <i class="bi bi-x-lg"></i> Reject
                                    </button>
                                    <button class="btn btn-sm btn-success px-3 fw-bold" onclick="APPROVALS_CONTROLLER.quickApprove('${v.voucherNo}')">
                                        <i class="bi bi-check-lg"></i> Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    toggleSelect(voucherNo, isChecked) {
        if (isChecked) {
            this.selectedVouchers.add(voucherNo);
        } else {
            this.selectedVouchers.delete(voucherNo);
        }
        this.updateSelectionUI();
    },

    updateSelectionUI() {
        const count = this.selectedVouchers.size;
        const bulkBtn = document.getElementById("btnBulkApprove");
        const countSpan = document.getElementById("selectedApprovalsCount");

        if (countSpan) countSpan.innerText = count;
        if (bulkBtn) {
            bulkBtn.disabled = count === 0;
            bulkBtn.classList.toggle("d-none", count === 0);
        }

        const selectAllCb = document.getElementById("selectAllApprovals");
        if (selectAllCb) {
            selectAllCb.checked = this.pendingVouchers.length > 0 && count === this.pendingVouchers.length;
        }

        // Highlight selected cards
        document.querySelectorAll(".approval-item-checkbox").forEach(cb => {
            const vNo = cb.dataset.voucher;
            cb.closest(".approval-card")?.classList.toggle("border-primary", this.selectedVouchers.has(vNo));
        });
    },

    async quickApprove(voucherNo) {
        const user = APP.getCurrentUser();
        try {
            APP.showLoader(`Approving Voucher #${voucherNo}...`);
            await dbApproveVoucher(voucherNo, user);
            APP.hideLoader();
            APP.showToast(`✅ Voucher #${voucherNo} approved!`, "success");
            this.fetchPending();
            if (window.LEDGER_CONTROLLER) LEDGER_CONTROLLER.fetchData(LEDGER_CONTROLLER.currentPage);
        } catch (err) {
            APP.hideLoader();
            APP.showToast("Approval failed: " + err.message, "danger");
        }
    },

    async handleBulkApprove() {
        const user = APP.getCurrentUser();
        const ids = Array.from(this.selectedVouchers);
        if (ids.length === 0) return;

        if (!confirm(`Are you sure you want to approve ${ids.length} selected vouchers?`)) {
            return;
        }

        try {
            APP.showLoader(`Approving ${ids.length} vouchers...`);
            const res = await dbBulkApprove(ids, user);
            APP.hideLoader();
            APP.showToast(`✅ Successfully approved ${res.successCount} vouchers.`, "success");
            this.fetchPending();
            if (window.LEDGER_CONTROLLER) LEDGER_CONTROLLER.fetchData(LEDGER_CONTROLLER.currentPage);
        } catch (err) {
            APP.hideLoader();
            APP.showToast("Bulk approve error: " + err.message, "danger");
        }
    },

    openRejectModal(voucherNo) {
        this.activeRejectVoucherNo = voucherNo;
        document.getElementById("rejectVoucherNoLabel").innerText = voucherNo;
        document.getElementById("rejectReasonInput").value = "";
        
        const modal = new bootstrap.Modal(document.getElementById("rejectModal"));
        modal.show();
    },

    async handleConfirmReject() {
        const reason = document.getElementById("rejectReasonInput").value;
        if (!reason || !reason.trim()) {
            APP.showToast("Please provide a rejection reason.", "warning");
            return;
        }

        const user = APP.getCurrentUser();
        const vNo = this.activeRejectVoucherNo;

        try {
            APP.showLoader(`Rejecting Voucher #${vNo}...`);
            await dbRejectVoucher(vNo, user, reason);
            APP.hideLoader();

            // Hide modal
            const modalEl = document.getElementById("rejectModal");
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            APP.showToast(`❌ Voucher #${vNo} rejected.`, "info");
            this.fetchPending();
            if (window.LEDGER_CONTROLLER) LEDGER_CONTROLLER.fetchData(LEDGER_CONTROLLER.currentPage);
        } catch (err) {
            APP.hideLoader();
            APP.showToast("Reject failed: " + err.message, "danger");
        }
    }
};

window.APPROVALS_CONTROLLER = APPROVALS_CONTROLLER;

