/**
 * BunaFrank SMS & Receipt Validator
 *
 * Parses the standard Telebirr SMS format:
 * "Dear TAMIRAT You have transferred ETB 15.00 to Yohanis Ashenafi (2519****8294)
 *  on 08/05/2026 17:20:46. Your transaction number is DE84OPTF9M. ..."
 */
export interface TelebirrSmsData {
    senderName: string;
    amount: number;
    recipientName: string;
    recipientPhoneMasked: string;
    recipientPhoneLast4: string;
    transactionId: string;
    dateTime: string;
    serviceFee: number;
    receiptUrl: string;
}
export interface ValidationResult {
    valid: boolean;
    data?: TelebirrSmsData | any;
    error?: string;
    onlineVerified?: boolean;
    isOcr?: boolean;
}
export declare function parseTelebirrSms(smsText: string): TelebirrSmsData | null;
/**
 * Validates a receipt image via the Scraper Engine's OCR
 */
export declare function validateReceiptImage(fileUrl: string, expectedAmount: number): Promise<ValidationResult>;
export declare function validateTelebirrSms(smsText: string, expectedAmount: number, receiverPhone: string): Promise<ValidationResult>;
//# sourceMappingURL=bunafrankValidator.d.ts.map