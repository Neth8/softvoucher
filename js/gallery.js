/**
 * SoftCreation Voucher System
 * Receipts & Bills Repository (Visual Gallery)
 */

const GALLERY_CONTROLLER = {
    currentPage: 1,
    pageSize: 18,
    items: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const searchInput = document.getElementById("gallerySearchVoucher");
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener("input", () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.fetchGallery(1), 350);
            });
        }

        const dateInput = document.getElementById("gallerySearchDate");
        if (dateInput) {
            dateInput.addEventListener("change", () => this.fetchGallery(1));
        }
    },

    async fetchGallery(page = 1) {
        this.currentPage = page;
        const container = document.getElementById("galleryGrid");
        if (container) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                    Loading receipt attachments...
                </div>
            `;
        }

        const searchVoucher = (document.getElementById("gallerySearchVoucher")?.value || "").trim();
        const searchDate = document.getElementById("gallerySearchDate")?.value || "";

        try {
            // Fetch vouchers with bills
            const res = await dbGetVouchersPaginated({
                page: this.currentPage,
                pageSize: this.pageSize,
                status: "ALL",
                searchVoucher: searchVoucher,
                searchDate: searchDate,
                orderBy: "id",
                orderAsc: false
            });

            // Extract all bills
            const galleryItems = [];
            res.records.forEach(v => {
                const urls = STORAGE_SERVICE.parseBillUrls(v.billUrl);
                urls.forEach((url, idx) => {
                    galleryItems.push({
                        url: url,
                        isPdf: STORAGE_SERVICE.isPdfUrl(url),
                        voucherNo: v.voucherNo,
                        date: v.date,
                        amount: v.amount,
                        bank: v.bank,
                        type: v.type,
                        index: idx + 1
                    });
                });
            });

            this.items = galleryItems;
            this.renderGrid(res.total, res.totalPages);
        } catch (err) {
            console.error("Gallery fetch error:", err);
            if (container) {
                container.innerHTML = `
                    <div class="col-12 text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> ${err.message}
                    </div>
                `;
            }
        }
    },

    renderGrid(totalVouchers, totalPages) {
        const container = document.getElementById("galleryGrid");
        if (!container) return;

        if (this.items.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <i class="bi bi-images fs-1 d-block mb-2"></i>
                    <h5>No receipt attachments found.</h5>
                    <p class="small">Vouchers with attached bills will display here.</p>
                </div>
            `;
            return;
        }

        let html = "";
        this.items.forEach(item => {
            const previewContent = item.isPdf
                ? `<div class="gallery-pdf-preview"><i class="bi bi-file-earmark-pdf-fill text-danger fs-1"></i><span class="small mt-2 font-monospace">PDF Document</span></div>`
                : `<img src="${item.url}" alt="Receipt" loading="lazy" class="gallery-img">`;

            html += `
                <div class="col-xl-2 col-lg-3 col-md-4 col-sm-6">
                    <div class="card card-custom h-100 gallery-card shadow-sm">
                        <div class="gallery-preview-wrap" onclick="APP.openMediaPreview('${item.url}')">
                            ${previewContent}
                            <div class="gallery-overlay">
                                <i class="bi bi-zoom-in fs-3 text-white"></i>
                            </div>
                        </div>
                        <div class="p-2 d-flex flex-column justify-content-between flex-grow-1">
                            <div>
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <span class="fw-bold text-primary font-monospace small">#${item.voucherNo}</span>
                                    <span class="badge bg-secondary bg-opacity-25 text-body small" style="font-size:0.65rem;">${item.type}</span>
                                </div>
                                <div class="small text-muted" style="font-size:0.75rem;">${item.date}</div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                                <span class="fw-bold text-success small">Rs. ${item.amount.toLocaleString("en-LK")}</span>
                                <div class="btn-group btn-group-sm">
                                    <a href="${item.url}" target="_blank" class="btn btn-outline-secondary py-0 px-2" title="Open Original Link">
                                        <i class="bi bi-box-arrow-up-right"></i>
                                    </a>
                                    <button class="btn btn-outline-primary py-0 px-2" onclick="APP.viewVoucher('${item.voucherNo}')" title="View Full Voucher">
                                        <i class="bi bi-file-text"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        this.renderPagination(totalPages);
    },

    renderPagination(totalPages) {
        const pag = document.getElementById("galleryPagination");
        if (!pag) return;

        if (totalPages <= 1) {
            pag.innerHTML = "";
            return;
        }

        let html = `
            <div class="d-flex justify-content-center align-items-center gap-2 mt-4">
                <button class="btn btn-sm btn-outline-secondary" ${this.currentPage <= 1 ? "disabled" : ""} 
                    onclick="GALLERY_CONTROLLER.fetchGallery(${this.currentPage - 1})">
                    &laquo; Previous
                </button>
                <span class="small text-muted px-2">Page ${this.currentPage} of ${totalPages}</span>
                <button class="btn btn-sm btn-outline-secondary" ${this.currentPage >= totalPages ? "disabled" : ""} 
                    onclick="GALLERY_CONTROLLER.fetchGallery(${this.currentPage + 1})">
                    Next &raquo;
                </button>
            </div>
        `;
        pag.innerHTML = html;
    }
};

