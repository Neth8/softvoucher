/**
 * SoftCreation Voucher System
 * Core Application Controller & UI Router
 */

const APP = {
    currentUser: null,
    currentTheme: "dark",

    init() {
        this.initTheme();
        this.checkSession();
        this.bindGlobalEvents();

        // Initialize sub-controllers
        if (window.VOUCHER_CONTROLLER) VOUCHER_CONTROLLER.init();
        if (window.LEDGER_CONTROLLER) LEDGER_CONTROLLER.init();
        if (window.APPROVALS_CONTROLLER) APPROVALS_CONTROLLER.init();
        if (window.GALLERY_CONTROLLER) GALLERY_CONTROLLER.init();
    },

    initTheme() {
        const saved = localStorage.getItem("softcreation_theme_v2") || "dark";
        this.setTheme(saved);
    },

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute("data-bs-theme", theme);
        localStorage.setItem("softcreation_theme_v2", theme);

        const icon = document.getElementById("themeToggleIcon");
        if (icon) {
            icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
        }
    },

    toggleTheme() {
        const next = this.currentTheme === "dark" ? "light" : "dark";
        this.setTheme(next);
    },

    bindGlobalEvents() {
        // Theme toggle button
        const themeBtn = document.getElementById("btnToggleTheme");
        if (themeBtn) themeBtn.addEventListener("click", () => this.toggleTheme());

        // Login form
        const loginBtn = document.getElementById("btnLogin");
        if (loginBtn) loginBtn.addEventListener("click", () => this.handleLogin());

        const loginInput = document.getElementById("loginIdentifier");
        if (loginInput) {
            loginInput.addEventListener("keydown", (e) => {
                if (e.key === "Enter") this.handleLogin();
            });
        }

        // Logout button
        const logoutBtn = document.getElementById("btnLogout");
        if (logoutBtn) logoutBtn.addEventListener("click", () => this.logout());

        // Export CSV button
        const csvBtn = document.getElementById("btnExportCsv");
        if (csvBtn) csvBtn.addEventListener("click", () => this.handleCsvExport());

        // Generate PDF report button
        const reportBtn = document.getElementById("btnGenerateMonthlyReport");
        if (reportBtn) reportBtn.addEventListener("click", () => this.handleGenerateReport());

        // Maintenance switch
        const maintSwitch = document.getElementById("switchMaintenance");
        if (maintSwitch) maintSwitch.addEventListener("change", (e) => this.handleMaintenanceToggle(e.target.checked));
    },

    checkSession() {
        const stored = localStorage.getItem("softcreation_user_v2");
        if (stored) {
            try {
                this.currentUser = JSON.parse(stored);
                this.setupAuthenticatedUser(this.currentUser);
                return;
            } catch {
                localStorage.removeItem("softcreation_user_v2");
            }
        }
        this.showLoginScreen();
    },

    async handleLogin() {
        const input = document.getElementById("loginIdentifier").value.trim();
        const errDiv = document.getElementById("loginErrorMsg");
        const btn = document.getElementById("btnLogin");

        if (!input) {
            errDiv.innerText = "Please enter your email or username.";
            return;
        }

        errDiv.innerText = "";
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing In...';

        try {
            const { user, maintenance } = await dbLogin(input);
            this.currentUser = user;
            localStorage.setItem("softcreation_user_v2", JSON.stringify(user));

            this.setupAuthenticatedUser(user);
            this.showToast(`Welcome back, ${user.username || user.email}!`, "success");
        } catch (err) {
            console.error("Login error:", err);
            errDiv.innerText = err.message;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Sign In';
        }
    },

    setupAuthenticatedUser(user) {
        document.getElementById("loginOverlay").classList.add("d-none");
        document.getElementById("appContainer").classList.remove("d-none");

        // Set user badge in sidebar
        document.getElementById("sidebarUserEmail").innerText = user.email;
        document.getElementById("sidebarUserRole").innerText = user.role || "User";

        const isApprover = canUserApprove(user);
        const isOwner = isSystemOwner(user);

        // Toggle approvals tab visibility
        const approvalsNav = document.getElementById("navApprovals");
        if (approvalsNav) {
            approvalsNav.classList.toggle("d-none", !isApprover);
        }

        // Toggle Maintenance control visibility in settings
        const maintArea = document.getElementById("maintenanceControlArea");
        if (maintArea) {
            maintArea.classList.toggle("d-none", !isOwner);
        }

        // Default to ledger or form
        this.switchTab("tab-ledger");
        this.loadSettingsStats();
    },

    logout() {
        localStorage.removeItem("softcreation_user_v2");
        this.currentUser = null;
        this.showLoginScreen();
    },

    showLoginScreen() {
        document.getElementById("loginOverlay").classList.remove("d-none");
        document.getElementById("appContainer").classList.add("d-none");
        document.getElementById("loginIdentifier").value = "";
        document.getElementById("loginErrorMsg").innerText = "";
    },

    getCurrentUser() {
        return this.currentUser;
    },

    switchTab(tabId) {
        // Update nav buttons
        document.querySelectorAll(".sidebar-nav-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tabId);
        });

        // Update tab views
        document.querySelectorAll(".tab-view").forEach(view => {
            view.classList.toggle("d-none", view.id !== tabId);
        });

        // Trigger view-specific loads
        if (tabId === "tab-ledger") {
            if (window.LEDGER_CONTROLLER) LEDGER_CONTROLLER.fetchData(1);
        } else if (tabId === "tab-approvals") {
            if (window.APPROVALS_CONTROLLER) APPROVALS_CONTROLLER.fetchPending();
        } else if (tabId === "tab-gallery") {
            if (window.GALLERY_CONTROLLER) GALLERY_CONTROLLER.fetchGallery(1);
        } else if (tabId === "tab-reports") {
            this.loadSettingsStats();
        }
    },

    async loadSettingsStats() {
        const statsEl = document.getElementById("statsTotalVouchers");
        const pendingEl = document.getElementById("statsPendingVouchers");
        const approvedEl = document.getElementById("statsApprovedVouchers");
        const rejectedEl = document.getElementById("statsRejectedVouchers");

        try {
            const stats = await dbGetSystemStats();
            if (statsEl) statsEl.innerText = stats.total.toLocaleString();
            if (pendingEl) pendingEl.innerText = stats.pending.toLocaleString();
            if (approvedEl) approvedEl.innerText = stats.approved.toLocaleString();
            if (rejectedEl) rejectedEl.innerText = stats.rejected.toLocaleString();

            const maintStatus = await dbGetMaintenanceStatus();
            const maintSwitch = document.getElementById("switchMaintenance");
            if (maintSwitch) maintSwitch.checked = (maintStatus === "ON");
        } catch (err) {
            console.warn("Stats load notice:", err);
        }
    },

    async handleMaintenanceToggle(isOn) {
        if (!isSystemOwner(this.currentUser)) return;
        const newStatus = isOn ? "ON" : "OFF";
        try {
            this.showLoader(`Setting Maintenance Mode ${newStatus}...`);
            await dbSetMaintenanceStatus(newStatus, this.currentUser.email);
            this.hideLoader();
            this.showToast(`Maintenance Mode set to ${newStatus}`, "info");
        } catch (err) {
            this.hideLoader();
            this.showToast("Failed to change maintenance mode: " + err.message, "danger");
        }
    },

    async handleCsvExport() {
        const btn = document.getElementById("btnExportCsv");
        btn.disabled = true;
        try {
            this.showLoader("Generating CSV database backup...");
            await REPORT_SERVICE.exportCsvBackup();
            this.hideLoader();
            this.showToast("✅ CSV backup downloaded successfully!", "success");
        } catch (err) {
            this.hideLoader();
            this.showToast("CSV export failed: " + err.message, "danger");
        } finally {
            btn.disabled = false;
        }
    },

    async handleGenerateReport() {
        const month = document.getElementById("reportMonthSelect").value;
        if (!month) {
            this.showToast("Please choose a month first.", "warning");
            return;
        }

        const btn = document.getElementById("btnGenerateMonthlyReport");
        btn.disabled = true;
        try {
            this.showLoader(`Generating ${month} Expense Report PDF...`);
            const filename = await REPORT_SERVICE.generateMonthlyReport(month);
            this.hideLoader();
            this.showToast(`✅ Report downloaded: ${filename}`, "success");
        } catch (err) {
            this.hideLoader();
            this.showToast(err.message, "danger");
        } finally {
            btn.disabled = false;
        }
    },

    /**
     * View Voucher Preview Modal (with PDF Print capability)
     */
    async viewVoucher(voucherNo) {
        this.showLoader("Loading voucher details...");
        try {
            const client = getSupabaseClient();
            const { data, error } = await client
                .from(CONFIG.TABLES.VOUCHERS)
                .select("*")
                .eq("voucher_no", voucherNo)
                .maybeSingle();

            this.hideLoader();
            if (error || !data) throw new Error("Voucher not found: " + voucherNo);

            const v = normalizeVoucherRow(data);
            const billUrls = STORAGE_SERVICE.parseBillUrls(v.billUrl);

            document.getElementById("pvVoucherNo").innerText = v.voucherNo;
            document.getElementById("pvDate").innerText = v.date;
            document.getElementById("pvAmount").innerText = `Rs. ${v.amount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}`;
            document.getElementById("pvType").innerText = v.type + (v.employeeNo ? ` (${v.employeeNo})` : "");
            document.getElementById("pvBank").innerText = v.bank;
            document.getElementById("pvNote").innerText = v.note || "No additional description provided.";
            document.getElementById("pvPreparedBy").innerText = v.userEmail;

            // Status Badge
            const statusBadge = document.getElementById("pvStatus");
            statusBadge.className = "badge fs-6";
            if (v.status === "APPROVED") {
                statusBadge.classList.add("bg-success");
                statusBadge.innerText = "APPROVED";
            } else if (v.status === "REJECTED") {
                statusBadge.classList.add("bg-danger");
                statusBadge.innerText = "REJECTED";
            } else {
                statusBadge.classList.add("bg-warning", "text-dark");
                statusBadge.innerText = "PENDING APPROVAL";
            }

            // Approver details
            const approvedDiv = document.getElementById("pvApprovedDetails");
            if (v.status === "APPROVED" && v.approvedBy) {
                approvedDiv.innerHTML = `
                    <p class="text-muted small text-uppercase fw-bold mb-1">Digitally Approved By</p>
                    <p class="mb-0 fw-bold text-success"><i class="bi bi-shield-check"></i> ${v.approvedBy}</p>
                    <div class="text-muted small">${v.approvedTime || ""}</div>
                `;
            } else if (v.status === "REJECTED" && v.rejectReason) {
                approvedDiv.innerHTML = `
                    <p class="text-muted small text-uppercase fw-bold mb-1">Rejection Details</p>
                    <p class="mb-0 fw-bold text-danger"><i class="bi bi-x-circle"></i> ${v.hiddenData?.rejectedBy || "Approver"}</p>
                    <div class="text-danger small fst-italic">"${v.rejectReason}"</div>
                `;
            } else {
                approvedDiv.innerHTML = `
                    <p class="text-muted small text-uppercase fw-bold mb-1">Approval Status</p>
                    <p class="mb-0 fw-bold text-warning"><i class="bi bi-clock"></i> Awaiting Management Approval</p>
                `;
            }

            // Bill attachment preview buttons
            const billLinksDiv = document.getElementById("pvBillLinks");
            if (billUrls.length > 0) {
                billLinksDiv.innerHTML = `
                    <p class="small text-muted fw-bold mb-2">Attached Supporting Bills (${billUrls.length}):</p>
                    <div class="d-flex flex-wrap gap-2">
                        ${billUrls.map((url, i) => `
                            <a href="${url}" target="_blank" class="btn btn-sm btn-outline-secondary">
                                <i class="bi bi-paperclip"></i> View Bill ${i + 1}
                            </a>
                        `).join("")}
                    </div>
                `;
                billLinksDiv.classList.remove("d-none");
            } else {
                billLinksDiv.innerHTML = "";
                billLinksDiv.classList.add("d-none");
            }

            const modal = new bootstrap.Modal(document.getElementById("viewVoucherModal"));
            modal.show();
        } catch (err) {
            this.hideLoader();
            this.showToast(err.message, "danger");
        }
    },

    openMediaPreview(url) {
        const modalImg = document.getElementById("lightboxImage");
        const modalFrame = document.getElementById("lightboxFrame");
        const openOrigBtn = document.getElementById("lightboxOpenOriginal");

        openOrigBtn.href = url;

        if (STORAGE_SERVICE.isPdfUrl(url)) {
            modalImg.classList.add("d-none");
            modalFrame.classList.remove("d-none");
            modalFrame.src = url;
        } else {
            modalFrame.classList.add("d-none");
            modalImg.classList.remove("d-none");
            modalImg.src = url;
        }

        const modal = new bootstrap.Modal(document.getElementById("mediaLightboxModal"));
        modal.show();
    },

    previewBills(voucherNo) {
        this.viewVoucher(voucherNo);
    },

    showLoader(msg = "Loading...") {
        const loader = document.getElementById("globalLoader");
        const text = document.getElementById("globalLoaderText");
        if (text) text.innerText = msg;
        if (loader) loader.classList.remove("d-none");
    },

    hideLoader() {
        const loader = document.getElementById("globalLoader");
        if (loader) loader.classList.add("d-none");
    },

    showToast(message, type = "info") {
        const container = document.getElementById("toastContainer");
        if (!container) return;

        const toastEl = document.createElement("div");
        toastEl.className = `toast align-items-center text-bg-${type} border-0 show shadow-lg mb-2`;
        toastEl.setAttribute("role", "alert");
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body fw-bold">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        container.appendChild(toastEl);
        setTimeout(() => {
            toastEl.classList.remove("show");
            setTimeout(() => toastEl.remove(), 300);
        }, 4000);
    }
};

// Global bootstrap on window load
window.addEventListener("DOMContentLoaded", () => {
    APP.init();
});

