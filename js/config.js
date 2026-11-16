/**
 * SoftCreation Voucher System
 * Application Configuration & Constants
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
    APPROVER_ROLES: ["Owner", "CFO", "CEO", "Admin"],
    APPROVER_EMAILS: [
        "kavini.softcreation@gmail.com",
        "yachitha.softcreation@gmail.com",
        "madumali.softcreation@gmail.com"
    ],

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

// Check if user has approval privileges
function canUserApprove(user) {
    if (!user) return false;
    const roleMatch = CONFIG.APPROVER_ROLES.some(r => (user.role || '').toLowerCase() === r.toLowerCase());
    const emailMatch = CONFIG.APPROVER_EMAILS.some(e => (user.email || '').toLowerCase() === e.toLowerCase());
    const ownerMatch = (user.email || '').toLowerCase() === CONFIG.OWNER_EMAIL.toLowerCase();
    return roleMatch || emailMatch || ownerMatch;
}

// Check if user is system owner
function isSystemOwner(user) {
    if (!user) return false;
    return (user.email || '').toLowerCase() === CONFIG.OWNER_EMAIL.toLowerCase() || (user.role || '').toLowerCase() === 'owner';
}

