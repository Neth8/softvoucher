/**
 * SoftCreation Voucher System
 * Application Configuration & Role Permissions Matrix
 * Directly modeled from original index.html & codegogglescript.gs
 */
const CONFIG = {
    SUPABASE_URL: "https://qyxgamverzdmhtvezbft.supabase.co",
    SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5eGdhbXZlcnpkbWh0dmV6YmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NjUwMDgsImV4cCI6MjA4MzQ0MTAwOH0.HQhMiD8DwMHMoHj0JtVIXCXhJArfiNnwMfz3a8Z5jyk",
    
    TABLES: {
        VOUCHERS: "softcreation_vouchers",
        USERS: "softcreation_users",
        LOGS: "softcreation_logs",
        SETTINGS: "softcreation_settings"
    },

    STORAGE_BUCKET: "voucher-bills",

    OWNER_EMAIL: "systemadmin.softcreation@gmail.com",
    
    BANKS: [
        "People's Bank 226100130071423",
        "BOC 92746436",
        "Sampath bank 021510002668",
        "CASH BANK",
        "People's Bank New 012100110071423",
        "Com Bank - 1000671993",
        "NDB - 111000097345",
        "COM MMA - 2000272029",
        "SAMPATH MMA - 121515001498"
    ],

    EXPENSE_TYPES: [
        "Food",
        "Travel",
        "Supplies",
        "Welfare",
        "Utilities",
        "Salary",
        "Commission",
        "Other"
    ],

    PAGE_SIZE: 15
};

/**
 * Exact Role & Email Permissions Matrix
 * Reconstructed from:
 * - index.html lines 661-677
 * - indexgooglescript.html lines 799-820
 * - codegogglescript.gs lines 133-135 & 306
 *
 * Rules:
 * - Owner (systemadmin.softcreation@gmail.com): Full access to everything + Maintenance mode
 * - CFO (e.g. yachitha@..., madumali@...): Submit, Approve, Audit/Ledger, All Bills, Reports
 * - CEO (e.g. kavini.softcreation@gmail.com): Approve, Audit/Ledger, All Bills, Reports (Does NOT submit vouchers)
 * - Admin: Submit, Audit, All Bills. Only madumali.softcreation@gmail.com can Approve!
 * - Auditor: Audit/Ledger, All Bills, Reports (Does NOT submit vouchers, does NOT approve)
 * - User: Submit, View only own vouchers ("My Vouchers")
 */
function getUserPermissions(user) {
    if (!user) {
        return {
            role: "Guest",
            email: "",
            canSubmit: false,
            canApprove: false,
            canViewAudit: false,
            canViewAllBills: false,
            isOwner: false,
            defaultTab: "tab-ledger"
        };
    }

    const email = (user.email || "").toLowerCase().trim();
    const role = (user.role || "User").trim();

    let showForm = false;
    let showApprovals = false;
    let showAudit = false;
    let showAllBills = false;
    let isOwner = false;

    // 1. OWNER
    if (role === "Owner" || email === CONFIG.OWNER_EMAIL.toLowerCase()) {
        showForm = true;
        showApprovals = true;
        showAudit = true;
        showAllBills = true;
        isOwner = true;
    }
    // 2. ADMIN
    else if (role === "Admin") {
        showForm = true;
        showAllBills = true;
        showAudit = true;
        // In original system: ONLY show approvals if the admin is Madumali
        if (email === "madumali.softcreation@gmail.com") {
            showApprovals = true;
        }
    }
    // 3. CFO
    else if (role === "CFO") {
        showForm = true;
        showApprovals = true;
        showAllBills = true;
        showAudit = true;
    }
    // 4. CEO (e.g. Kavini)
    // Original system: showApprovals = true, showAllBills = true, showForm = false
    else if (role === "CEO") {
        showForm = false; // CEO reviews and approves; executive role does not submit vouchers
        showApprovals = true;
        showAllBills = true;
        showAudit = true;
    }
    // 5. AUDITOR
    // Original system: showAudit = true, showAllBills = true, showForm = false, showApprovals = false
    else if (role === "Auditor") {
        showForm = false;
        showApprovals = false;
        showAudit = true;
        showAllBills = true;
    }
    // 6. STANDARD USER
    else {
        showForm = true;
        showApprovals = false;
        showAudit = false; // Only see own vouchers
        showAllBills = false;
    }

    // Default Landing Tab based on role
    let defaultTab = "tab-ledger";
    if (role === "CEO" || (!showForm && showApprovals)) {
        defaultTab = "tab-approvals";
    } else if (role === "Auditor") {
        defaultTab = "tab-ledger";
    } else if (showForm) {
        defaultTab = "tab-ledger";
    }

    return {
        role,
        email,
        isOwner,
        canSubmit: showForm,
        canApprove: showApprovals,
        canViewAudit: showAudit,
        canViewAllBills: showAllBills,
        defaultTab
    };
}

// Helper wrapper functions
function canUserApprove(user) {
    if (!user) return false;
    return getUserPermissions(user).canApprove;
}

function canUserSubmit(user) {
    if (!user) return false;
    return getUserPermissions(user).canSubmit;
}

function isSystemOwner(user) {
    if (!user) return false;
    return getUserPermissions(user).isOwner;
}

window.CONFIG = CONFIG;
window.getUserPermissions = getUserPermissions;
window.canUserApprove = canUserApprove;
window.canUserSubmit = canUserSubmit;
window.isSystemOwner = isSystemOwner;
