/**
 * SoftCreation Voucher System
 * Supabase Storage Service (Bills & Receipts Uploads)
 */

const STORAGE_SERVICE = {
    /**
     * Upload an array of File objects to Supabase Storage
     * Returns an array of public URLs
     */
    async uploadFiles(fileList, voucherNo) {
        if (!fileList || fileList.length === 0) return [];
        const client = getSupabaseClient();
        const urls = [];

        for (let i = 0; i < fileList.length; i++) {
            const item = fileList[i];

            // If item already has an existing URL (e.g. during edit mode)
            if (item.existingUrl) {
                urls.push(item.existingUrl);
                continue;
            }

            const file = item.fileObject;
            if (!file) continue;

            // Generate clean unique filename
            const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const timeStamp = Date.now();
            const filePath = `${voucherNo}/${timeStamp}_${i}_${cleanName}`;

            try {
                // Upload directly to Supabase Storage bucket
                const { data, error } = await client.storage
                    .from(CONFIG.STORAGE_BUCKET)
                    .upload(filePath, file, {
                        cacheControl: "3600",
                        upsert: true
                    });

                if (error) {
                    console.warn(`Supabase Storage upload warning (${file.name}):`, error.message);
                    // If bucket not configured, fallback to base64 preview or report
                    throw error;
                }

                // Retrieve public URL
                const { data: urlData } = client.storage
                    .from(CONFIG.STORAGE_BUCKET)
                    .getPublicUrl(filePath);

                if (urlData && urlData.publicUrl) {
                    urls.push(urlData.publicUrl);
                }
            } catch (uploadErr) {
                console.error("Storage error for file:", file.name, uploadErr);
                // If storage bucket is missing, provide a helpful notification
                throw new Error(
                    `Failed to upload '${file.name}' to Supabase Storage.\n` +
                    `Please ensure a public bucket named '${CONFIG.STORAGE_BUCKET}' exists in your Supabase project dashboard.`
                );
            }
        }

        return urls;
    },

    /**
     * Helper to parse comma-separated bill URLs
     */
    parseBillUrls(billUrlString) {
        if (!billUrlString || billUrlString === "No Bill" || billUrlString === "null") {
            return [];
        }
        return billUrlString.split(",")
            .map(u => u.trim())
            .filter(u => u.length > 0 && u !== "No Bill");
    },

    /**
     * Check if a URL is an image or PDF
     */
    isPdfUrl(url) {
        if (!url) return false;
        const clean = url.toLowerCase().split("?")[0];
        return clean.endsWith(".pdf") || url.includes("application/pdf");
    }
};

