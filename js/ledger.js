/**
 * SoftCreation Voucher System
 * Unified Paginated Voucher Ledger Controller
 */

const LEDGER_CONTROLLER = {
    currentPage: 1,
    pageSize: CONFIG.PAGE_SIZE,
    currentStatus: "ALL",
    scope: "ALL", // Default to "ALL" so users immediately see existing database records
    records: [],
    totalRecords: 0,
    totalPages: 1,

    init() {
        this.bindEvents();
    },

    bindEvents() {
        // Search inputs
        const searchVoucher = document.getElementById("ledgerSearchVoucher");
        if (searchVoucher) {
            let debounceTimer;
            searchVoucher.addEventListener("input", () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.fetchData(1), 350);
            });
        }

        const searchDate = document.getElementById("ledgerSearchDate");
        if (searchDate) {
            searchDate.addEventListener("change", () => this.fetchData(1));
        }

        const searchType = document.getElementById("ledgerSearchType");
        if (searchType) {
            searchType.innerHTML = '<option value="ALL">All Types</option>' +
                CONFIG.EXPENSE_TYPES.map(t => `<option value="${t}">${t}</option>`).join("");
            searchType.addEventListener("change", () => this.fetchData(1));
        }

        const scopeSelect = document.getElementById("ledgerScope");
        if (scopeSelect) {
            scopeSelect.addEventListener("change", (e) => {
                this.scope = e.target.value;
                this.fetchData(1);
            });
        }

        const pageSizeSelect = document.getElementById("ledgerPageSize");
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener("change", (e) => {
                this.pageSize = parseInt(e.target.value, 10) || CONFIG.PAGE_SIZE;
                this.fetchData(1);
            });
        }
    },

    setStatusFilter(status) {
        this.currentStatus = status;
        document.querySelectorAll(".filter-pill, .ledger-status-pill").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.status === status);
        });
        this.fetchData(1);
    },

    clearFilters() {
        document.getElementById("ledgerSearchVoucher").value = "";
        document.getElementById("ledgerSearchDate").value = "";
        document.getElementById("ledgerSearchType").value = "ALL";
        this.currentStatus = "ALL";
        document.querySelectorAll(".filter-pill, .ledger-status-pill").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.status === "ALL");
        });
        this.fetchData(1);
    },

    async fetchData(targetPage = 1) {
        const user = APP.getCurrentUser();
        if (!user) return;

        this.currentPage = targetPage;
        const tbody = document.getElementById("ledgerTableBody");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div> Loading records...</td></tr>`;
        }

        const searchVoucher = (document.getElementById("ledgerSearchVoucher")?.value || "").trim();
        const searchDate = document.getElementById("ledgerSearchDate")?.value || "";
        const searchType = document.getElementById("ledgerSearchType")?.value || "ALL";

        const filterUserEmail = this.scope === "MY" ? user.email : null;

        try {
            const res = await dbGetVouchersPaginated({
                page: this.currentPage,
                pageSize: this.pageSize,
                status: this.currentStatus,
                userEmail: filterUserEmail,
                searchVoucher: searchVoucher,
                searchDate: searchDate,
                searchType: searchType,
                orderBy: "id",
                orderAsc: false
            });

            this.records = res.records;
            this.totalRecords = res.total;
            this.totalPages = res.totalPages;

            this.renderTable();
            this.renderPagination();
        } catch (err) {
            console.error("Ledger fetch error:", err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i> ${err.message}</td></tr>`;
            }
        }
    },

    renderTable() {
        const tbody = document.getElementById("ledgerTableBody");
        if (!tbody) return;

        if (this.records.length === 0) {
            const scopeNote = this.scope === "MY"
                ? `<p class="small mt-1">You are currently viewing <b>My Vouchers</b>. <a href="#" class="text-primary fw-bold" onclick="document.getElementById('ledgerScope').value='ALL';LEDGER_CONTROLLER.scope='ALL';LEDGER_CONTROLLER.fetchData(1);return false;">Click here to switch to All Vouchers</a>.</p>`
                : `<p class="small mt-1">Check your search criteria or verify that tables and RLS permissions are configured in Supabase.</p>`;
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted"><i class="bi bi-inbox fs-2 d-block mb-2"></i> No vouchers found.${scopeNote}</td></tr>`;
            return;
        }

        const user = APP.getCurrentUser();
        const canApprove = canUserApprove(user);

        let html = "";
        this.records.forEach(rec => {
            const billUrls = STORAGE_SERVICE.parseBillUrls(rec.billUrl);
            const statusBadge = this.getStatusBadge(rec.status);

            let actionButtons = `
                <button class="btn btn-sm btn-outline-primary" onclick="APP.viewVoucher('${rec.voucherNo}')" title="View & Print Voucher">
                    <i class="bi bi-printer"></i>
                </button>
            `;

            const perms = getUserPermissions(user);

            // Edit button if PENDING or REJECTED (only for roles with submit permission)
            if ((rec.status === "PENDING" || rec.status === "REJECTED") && perms.canSubmit) {
                if (rec.userEmail === user.email || perms.isOwner || perms.isCFO) {
                    actionButtons += `
                        <button class="btn btn-sm btn-outline-warning ms-1" onclick="LEDGER_CONTROLLER.triggerEdit('${rec.voucherNo}')" title="Edit Voucher">
                            <i class="bi bi-pencil"></i>
                        </button>
                    `;
                }
            }

            // Revert Approval button (Approver privileges only: Owner, CFO, CEO, Madumali)
            if (rec.status === "APPROVED" && perms.canApprove) {
                actionButtons += `
                    <button class="btn btn-sm btn-outline-secondary ms-1" onclick="LEDGER_CONTROLLER.triggerRevert('${rec.voucherNo}')" title="Revert Approval">
                        <i class="bi bi-arrow-counterclockwise"></i>
                    </button>
                `;
            }

            // Bill attachment icons/counter
            let billsBadge = '<span class="text-muted small">No Bill</span>';
            if (billUrls.length > 0) {
                billsBadge = `
                    <button class="btn btn-sm btn-light border px-2 py-0" onclick="APP.previewBills('${rec.voucherNo}')" title="View ${billUrls.length} attached bills">
                        <i class="bi bi-paperclip text-primary"></i> <b>${billUrls.length}</b>
                    </button>
                `;
            }

            html += `
                <tr>
                    <td class="voucher-no-cell">#${rec.voucherNo}</td>
                    <td class="fw-semibold text-secondary">${rec.date}</td>
                    <td><span class="badge bg-secondary bg-opacity-10 text-body border border-secondary border-opacity-25 py-1 px-2">${rec.type}</span></td>
                    <td class="small text-truncate" style="max-width: 180px;" title="${rec.bank}">${rec.bank}</td>
                    <td class="amount-cell text-end">Rs. ${rec.amount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</td>
                    <td class="text-center">${billsBadge}</td>
                    <td class="text-center">${statusBadge}</td>
                    <td class="text-end text-nowrap">${actionButtons}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    },

    getStatusBadge(status) {
        switch (status) {
            case "APPROVED":
                return '<span class="badge-status-approved"><i class="bi bi-check-circle-fill"></i> Approved</span>';
            case "REJECTED":
                return '<span class="badge-status-rejected"><i class="bi bi-x-circle-fill"></i> Rejected</span>';
            default:
                return '<span class="badge-status-pending"><i class="bi bi-clock-fill"></i> Pending</span>';
        }
    },

    renderPagination() {
        const info = document.getElementById("ledgerPaginationInfo");
        const paginationList = document.getElementById("ledgerPaginationControls");
        if (!info || !paginationList) return;

        const startIdx = this.totalRecords === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
        const endIdx = Math.min(this.currentPage * this.pageSize, this.totalRecords);

        info.innerText = `Showing ${startIdx}–${endIdx} of ${this.totalRecords} records`;

        let html = "";

        // Previous button
        html += `
            <li class="page-item ${this.currentPage <= 1 ? "disabled" : ""}">
                <button class="page-link" onclick="LEDGER_CONTROLLER.fetchData(${this.currentPage - 1})" aria-label="Previous">
                    <span aria-hidden="true">&laquo;</span>
                </button>
            </li>
        `;

        // Page numbers
        const maxButtons = 5;
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(this.totalPages, startPage + maxButtons - 1);
        if (endPage - startPage < maxButtons - 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }

        for (let p = startPage; p <= endPage; p++) {
            html += `
                <li class="page-item ${p === this.currentPage ? "active" : ""}">
                    <button class="page-link" onclick="LEDGER_CONTROLLER.fetchData(${p})">${p}</button>
                </li>
            `;
        }

        // Next button
        html += `
            <li class="page-item ${this.currentPage >= this.totalPages ? "disabled" : ""}">
                <button class="page-link" onclick="LEDGER_CONTROLLER.fetchData(${this.currentPage + 1})" aria-label="Next">
                    <span aria-hidden="true">&raquo;</span>
                </button>
            </li>
        `;

        paginationList.innerHTML = html;
    },

    triggerEdit(voucherNo) {
        const rec = this.records.find(r => r.voucherNo === voucherNo);
        if (rec) {
            VOUCHER_CONTROLLER.enterEditMode(rec);
        }
    },

    async triggerRevert(voucherNo) {
        if (!confirm(`Are you sure you want to REVERT Voucher #${voucherNo} approval back to PENDING?`)) {
            return;
        }

        const user = APP.getCurrentUser();
        try {
            APP.showLoader("Reverting approval status...");
            await dbRevertApproval(voucherNo, user);
            APP.hideLoader();
            APP.showToast(`Voucher #${voucherNo} reverted to PENDING`, "info");
            this.fetchData(this.currentPage);
            if (window.APPROVALS_CONTROLLER) APPROVALS_CONTROLLER.fetchPending();
        } catch (err) {
            APP.hideLoader();
            APP.showToast("Failed to revert: " + err.message, "danger");
        }
    }
};

window.LEDGER_CONTROLLER = LEDGER_CONTROLLER;

