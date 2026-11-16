/**
 * SoftCreation Voucher System
 * Supabase Client & Database Services
 */

let sb = null;

function getSupabaseClient() {
    if (!sb) {
        if (!window.supabase) {
            throw new Error("Supabase JS SDK is not loaded. Please check your internet connection.");
        }
        sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    }
    return sb;
}

/**
 * Format raw row from Supabase into standard UI record
 */
function normalizeVoucherRow(row) {
    if (!row) return null;
    const json = row.hidden_data || {};
    return {
        id: row.id,
        voucherNo: row.voucher_no,
        date: row.date,
        type: row.type,
        bank: row.bank,
        amount: Number(row.amount || 0),
        note: row.note || "",
        billUrl: row.bill_url || "No Bill",
        status: (row.status || "PENDING").toUpperCase(),
        userEmail: row.user_email || "",
        employeeNo: json.employeeNo || "",
        approvedBy: json.approvedBy || json.approved_by || "",
        approvedTime: json.approvedTime || json.approved_time || "",
        rejectReason: json.reason || "",
        hiddenData: json,
        createdDate: row.created_at || row.date
    };
}

/**
 * Audit log helper
 */
async function dbLogAction(userEmail, action, voucherNo, details) {
    try {
        const client = getSupabaseClient();
        await client.from(CONFIG.TABLES.LOGS).insert([{
            user_email: userEmail || "SYSTEM",
            action: action,
            voucher_no: voucherNo || "N/A",
            details: String(details || "")
        }]);
    } catch (err) {
        console.warn("Audit log notice:", err.message);
    }
}

/**
 * User login by email or username
 */
async function dbLogin(identifier) {
    const client = getSupabaseClient();
    const cleanId = (identifier || "").trim();
    if (!cleanId) throw new Error("Please enter your email or username.");

    const { data, error } = await client
        .from(CONFIG.TABLES.USERS)
        .select("*")
        .or(`email.eq.${cleanId},username.eq.${cleanId}`)
        .limit(1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
        throw new Error("Access Denied. User not found.");
    }

    const user = data[0];
    const maintenance = await dbGetMaintenanceStatus();

    if (maintenance === "ON" && !isSystemOwner(user)) {
        throw new Error("System is currently in MAINTENANCE MODE. Only System Administrator can access.");
    }

    return { user, maintenance };
}

/**
 * Maintenance mode status
 */
async function dbGetMaintenanceStatus() {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from(CONFIG.TABLES.SETTINGS)
            .select("value")
            .eq("key", "MAINTENANCE_MODE")
            .maybeSingle();

        if (error || !data) return "OFF";
        return data.value || "OFF";
    } catch {
        return "OFF";
    }
}

/**
 * Toggle maintenance mode
 */
async function dbSetMaintenanceStatus(status, userEmail) {
    const client = getSupabaseClient();
    try {
        await client.from(CONFIG.TABLES.SETTINGS).upsert([
            { key: "MAINTENANCE_MODE", value: status, updated_by: userEmail, updated_at: new Date().toISOString() }
        ], { onConflict: "key" });
    } catch (e) {
        console.warn("Could not write to settings table:", e.message);
    }
    await dbLogAction(userEmail, "MAINTENANCE", "SYSTEM", `Maintenance mode changed to ${status}`);
    return status;
}

/**
 * Calculate next sequence voucher number for given date (YYYY-MM-DD)
 * Format: YYYYMM + 2-digit zero-padded counter (e.g., 20261101)
 */
async function dbGetNextSequence(dateStr) {
    if (!dateStr) throw new Error("Date is required to generate sequence");
    const client = getSupabaseClient();
    const parts = dateStr.split("-");
    const prefix = `${parts[0]}${parts[1]}`;

    const { data, error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("voucher_no")
        .like("voucher_no", `${prefix}%`);

    if (error) throw new Error(error.message);

    let maxCount = 0;
    if (data && data.length > 0) {
        data.forEach(row => {
            const numPart = row.voucher_no ? row.voucher_no.replace(prefix, "") : "";
            const countNum = parseInt(numPart, 10);
            if (!isNaN(countNum) && countNum > maxCount) {
                maxCount = countNum;
            }
        });
    }

    const nextCount = maxCount + 1;
    const nextVoucherNo = prefix + nextCount.toString().padStart(2, "0");
    return { sequence: nextCount, voucherNo: nextVoucherNo };
}

/**
 * Check for duplicate voucher submission
 */
async function dbCheckDuplicate(date, amount, type, employeeNo) {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("id, type, hidden_data")
        .eq("date", date)
        .eq("amount", Number(amount))
        .eq("type", type);

    if (error || !data || data.length === 0) return false;

    if (type === "Salary" || type === "Commission") {
        return data.some(row => {
            const h = row.hidden_data || {};
            return h.employeeNo && h.employeeNo.toString().trim() === (employeeNo || "").toString().trim();
        });
    }

    return true;
}

/**
 * Create a new voucher
 */
async function dbCreateVoucher(formData, currentUser) {
    const isDup = await dbCheckDuplicate(formData.date, formData.amount, formData.type, formData.employeeNo);
    if (isDup) {
        throw new Error("⚠️ Possible Duplicate! A voucher with the same Date, Amount, and Type already exists.");
    }

    const { voucherNo } = await dbGetNextSequence(formData.date);
    const client = getSupabaseClient();

    const hiddenPayload = {
        ...formData,
        voucherNo: voucherNo,
        submittedBy: currentUser.email,
        submittedAt: new Date().toISOString()
    };

    const row = {
        voucher_no: voucherNo,
        date: formData.date,
        type: formData.type,
        bank: formData.bank,
        amount: Number(formData.amount),
        note: formData.note || "",
        bill_url: formData.billUrl || "No Bill",
        status: "PENDING",
        user_email: currentUser.email,
        hidden_data: hiddenPayload
    };

    const { data, error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .insert([row])
        .select();

    if (error) throw new Error(error.message);

    await dbLogAction(currentUser.email, "SUBMIT", voucherNo, `Amount: LKR ${formData.amount} | Type: ${formData.type}`);
    return normalizeVoucherRow(data[0]);
}

/**
 * Update existing voucher (only if PENDING or REJECTED)
 */
async function dbUpdateVoucher(voucherNo, formData, currentUser) {
    const client = getSupabaseClient();
    
    // Check existing record
    const { data: existing, error: fetchErr } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("*")
        .eq("voucher_no", voucherNo)
        .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("Voucher not found: " + voucherNo);

    if (existing.status !== "PENDING" && existing.status !== "REJECTED") {
        throw new Error("Cannot edit! Voucher is already finalized (" + existing.status + ").");
    }

    const newHidden = {
        ...(existing.hidden_data || {}),
        ...formData,
        lastEditedBy: currentUser.email,
        lastEditedAt: new Date().toISOString()
    };
    if (newHidden.reason) delete newHidden.reason;

    const updates = {
        date: formData.date,
        type: formData.type,
        bank: formData.bank,
        amount: Number(formData.amount),
        note: formData.note || "",
        bill_url: formData.billUrl || existing.bill_url || "No Bill",
        status: "PENDING",
        hidden_data: newHidden
    };

    const { data, error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .update(updates)
        .eq("voucher_no", voucherNo)
        .select();

    if (error) throw new Error(error.message);

    await dbLogAction(currentUser.email, "EDIT_RESUBMIT", voucherNo, "Voucher updated & resubmitted");
    return normalizeVoucherRow(data[0]);
}

/**
 * Approve a single voucher
 */
async function dbApproveVoucher(voucherNo, approver) {
    if (!canUserApprove(approver)) {
        throw new Error("You are not authorized to approve vouchers.");
    }

    const client = getSupabaseClient();
    const { data: record, error: fetchErr } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("*")
        .eq("voucher_no", voucherNo)
        .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!record) throw new Error("Voucher not found.");
    if (record.status !== "PENDING") throw new Error("Voucher is not pending approval.");

    const hidden = record.hidden_data || {};
    hidden.approvedBy = approver.email;
    hidden.approvedTime = new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" });

    const { error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .update({ status: "APPROVED", hidden_data: hidden })
        .eq("voucher_no", voucherNo);

    if (error) throw new Error(error.message);

    await dbLogAction(approver.email, "APPROVE", voucherNo, "Voucher Approved");
    return true;
}

/**
 * Reject a voucher with reason
 */
async function dbRejectVoucher(voucherNo, approver, reason) {
    if (!canUserApprove(approver)) {
        throw new Error("You are not authorized to reject vouchers.");
    }
    if (!reason || !reason.trim()) {
        throw new Error("A rejection reason is required.");
    }

    const client = getSupabaseClient();
    const { data: record, error: fetchErr } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("*")
        .eq("voucher_no", voucherNo)
        .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!record) throw new Error("Voucher not found.");
    if (record.status !== "PENDING") throw new Error("Voucher is not pending approval.");

    const hidden = record.hidden_data || {};
    hidden.reason = reason.trim();
    hidden.rejectedBy = approver.email;
    hidden.rejectedTime = new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" });

    const { error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .update({ status: "REJECTED", hidden_data: hidden })
        .eq("voucher_no", voucherNo);

    if (error) throw new Error(error.message);

    await dbLogAction(approver.email, "REJECT", voucherNo, "Reason: " + reason.trim());
    return true;
}

/**
 * Revert approval back to PENDING
 */
async function dbRevertApproval(voucherNo, approver) {
    if (!canUserApprove(approver)) {
        throw new Error("You are not authorized to revert voucher approvals.");
    }

    const client = getSupabaseClient();
    const { data: record, error: fetchErr } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("*")
        .eq("voucher_no", voucherNo)
        .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!record) throw new Error("Voucher not found.");

    const hidden = record.hidden_data || {};
    delete hidden.approvedBy;
    delete hidden.approvedTime;

    const { error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .update({ status: "PENDING", hidden_data: hidden })
        .eq("voucher_no", voucherNo);

    if (error) throw new Error(error.message);

    await dbLogAction(approver.email, "REVERT_APPROVAL", voucherNo, "Reverted back to PENDING");
    return true;
}

/**
 * Bulk approve multiple vouchers
 */
async function dbBulkApprove(voucherNos, approver) {
    if (!canUserApprove(approver)) {
        throw new Error("You are not authorized to bulk approve vouchers.");
    }
    if (!voucherNos || voucherNos.length === 0) {
        throw new Error("No vouchers selected for approval.");
    }

    let successCount = 0;
    const errors = [];

    for (const vNo of voucherNos) {
        try {
            await dbApproveVoucher(vNo, approver);
            successCount++;
        } catch (err) {
            errors.push(`${vNo}: ${err.message}`);
        }
    }

    return { successCount, errors };
}

/**
 * High-performance paginated vouchers query
 */
async function dbGetVouchersPaginated({
    page = 1,
    pageSize = CONFIG.PAGE_SIZE,
    status = "ALL",
    userEmail = null,
    searchVoucher = "",
    searchDate = "",
    searchType = "",
    orderBy = "id",
    orderAsc = false
} = {}) {
    const client = getSupabaseClient();
    let query = client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("*", { count: "exact" });

    if (status && status !== "ALL") {
        query = query.eq("status", status.toUpperCase());
    }

    if (userEmail) {
        query = query.eq("user_email", userEmail);
    }

    if (searchVoucher && searchVoucher.trim()) {
        query = query.ilike("voucher_no", `%${searchVoucher.trim()}%`);
    }

    if (searchDate) {
        query = query.eq("date", searchDate);
    }

    if (searchType && searchType !== "ALL") {
        query = query.eq("type", searchType);
    }

    query = query.order(orderBy, { ascending: orderAsc });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;

    return {
        records: (data || []).map(normalizeVoucherRow),
        total: totalRecords,
        page: page,
        pageSize: pageSize,
        totalPages: totalPages
    };
}

/**
 * Get all vouchers for CSV export
 */
async function dbExportAllVouchers() {
    const client = getSupabaseClient();
    const { data, error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("*")
        .order("id", { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(normalizeVoucherRow);
}

/**
 * Get approved vouchers for a specific month (YYYY-MM)
 */
async function dbGetMonthlyApprovedVouchers(monthStr) {
    if (!monthStr) throw new Error("Month is required (YYYY-MM)");
    const client = getSupabaseClient();
    const [year, month] = monthStr.split("-");
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    
    const startDate = `${monthStr}-01`;
    const endDate = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const { data, error } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("*")
        .eq("status", "APPROVED")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(normalizeVoucherRow);
}

/**
 * Get system statistics
 */
async function dbGetSystemStats() {
    const client = getSupabaseClient();
    
    // Total count
    const { count: totalCount } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("id", { count: "exact", head: true });

    // Pending count
    const { count: pendingCount } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING");

    // Approved count
    const { count: approvedCount } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("id", { count: "exact", head: true })
        .eq("status", "APPROVED");

    // Rejected count
    const { count: rejectedCount } = await client
        .from(CONFIG.TABLES.VOUCHERS)
        .select("id", { count: "exact", head: true })
        .eq("status", "REJECTED");

    return {
        total: totalCount || 0,
        pending: pendingCount || 0,
        approved: approvedCount || 0,
        rejected: rejectedCount || 0
    };
}

