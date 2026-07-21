function parseTelebirrSms(smsText) {
  try {
    const text = smsText.replace(/\s+/g, ' ').trim();
    const phonePatternMasked = `(?:(\\+?251|0)\\d{0,3}[^\\d\\s()]+(\\d{2,6}))`;
    const phonePatternFull   = `(\\+?251\\d{9}|09\\d{8})`;

    let transactionId = '';
    let recipientName = 'Unknown';
    let recipientPhoneMasked = '';
    let recipientPhoneLast4 = '';
    let amount = 0;
    let dateTime = '';
    let senderName = 'Unknown';
    let serviceFee = 0;

    const isOromo   = /Kabajamoo|Qarshii|Lakkoofsi|gaafa guyyaa|ergitanii/i.test(text);
    const isAmharic = /ወደ|ብር|ቁጥርዎ|ውድ/.test(text);

    if (isOromo) {
      const txnOr = text.match(/Lakkoofsi\s+sochii\s+maallaqaa\s+keessan\s+([A-Z0-9]{6,})/i);
      if (!txnOr) return null;
      transactionId = txnOr[1].replace(/['^.,]/g, '').trim();

      const orM = text.match(new RegExp(`Gara\\s+([^(]+?)\\s*\\(((?:\\+?251|0)\\d{0,3}[^\\d\\s()]+)(\\d{2,6})\\)tti`, 'i'));
      if (orM) {
        recipientName        = orM[1].trim();
        recipientPhoneMasked = orM[2] + orM[3];
        recipientPhoneLast4  = orM[3];
      }

      const orAmounts = [...text.matchAll(/Qarshii\s+([\d,]+\.?\d*)/gi)];
      if (orAmounts.length > 0) amount = parseFloat(orAmounts[0][1].replace(/,/g, ''));

      const orDate = text.match(/gaafa guyyaa\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
      dateTime    = orDate?.[1] || '';
      if (orAmounts.length > 1) serviceFee = parseFloat(orAmounts[1][1].replace(/,/g, ''));
    } else if (isAmharic) {
      const txnAm = text.match(/ቁጥርዎ\s+([A-Z0-9]{6,})/i);
      if (!txnAm) return null;
      transactionId = txnAm[1].trim();

      const amM = text.match(new RegExp(`ወደ\\s+([^(]+?)\\s*\\(((?:\\+?251|0)\\d{0,3}[^\\d\\s()]+)(\\d{2,6})\\)\\s+([\\d,]+\\.?\\d*)\\s+ብር`, 'i'));
      if (amM) {
        recipientName        = amM[1].trim();
        recipientPhoneMasked = amM[2] + amM[3];
        recipientPhoneLast4  = amM[3];
        amount               = parseFloat(amM[4].replace(/,/g, ''));
      }
      const amDate = text.match(/በ\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
      if (amDate) dateTime = amDate[1];
      const amFee = text.match(/የአገልግሎት ክፍያው\s+([\d.]+)/i);
      serviceFee = amFee ? parseFloat(amFee[1]) : 0;
    } else {
      const txnEn = text.match(/(?:transaction number is|Account Activity Number is)\s+([A-Z0-9]{6,20})/i);
      if (!txnEn) return null;
      transactionId = txnEn[1].replace(/['^.,]/g, '').trim();

      const enPatternTransferred = new RegExp(`transferred\\s+ETB\\s+([\\d,]+\\.?\\d*)\\s+to\\s+([^(]+?)\\s*\\((${phonePatternMasked})\\)`, 'i');
      const enPatternSent = new RegExp(`sent\\s+([\\d,]+\\.?\\d*)\\s+(?:Birr|ETB)\\s+to\\s+([^(]+?)\\s*\\((${phonePatternMasked})\\)`, 'i');

      let enMatch = text.match(enPatternTransferred) || text.match(enPatternSent);
      if (enMatch) {
        amount               = parseFloat(enMatch[1].replace(/,/g, ''));
        recipientName        = enMatch[2].trim();
        recipientPhoneMasked = enMatch[3] || '';
        recipientPhoneLast4  = enMatch[5] || '';
      } else {
        const enFull = text.match(/(?:transferred\s+ETB|sent)\s+([\d,]+\.?\d*)\s+(?:Birr|ETB)\s+to\s+([^(]+?)\s*\((\+?251\d{9}|09\d{8})\)/i);
        if (enFull) {
          amount               = parseFloat(enFull[1].replace(/,/g, ''));
          recipientName        = enFull[2].trim();
          recipientPhoneMasked = enFull[3];
          recipientPhoneLast4  = enFull[3].slice(-4);
        } else {
          const amtOnly = text.match(/(?:transferred|sent)\s+([\d,]+\.?\d*)\s+(?:Birr|ETB)/i);
          if (amtOnly) amount = parseFloat(amtOnly[1].replace(/,/g, ''));
        }
      }
      const enDate = text.match(/on\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
      dateTime = enDate?.[1] || '';
      const enSender = text.match(/Dear\s+([^\s\n,.]+)/i);
      senderName = enSender?.[1]?.trim() || 'Unknown';
      const enFee = text.match(/service fee is(?:\s+ETB)?\s+([\d.]+)/i);
      serviceFee = enFee ? parseFloat(enFee[1]) : 0;
    }

    if (!transactionId || amount <= 0) return null;

    if (!recipientPhoneMasked) {
      recipientPhoneMasked = 'Unknown';
      recipientPhoneLast4  = '';
    }

    const urlMatch = text.match(/(https:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/[A-Z0-9]+)/i);
    const receiptUrl = urlMatch?.[1] || `https://transactioninfo.ethiotelecom.et/receipt/${transactionId}`;

    return {
      senderName,
      amount,
      recipientName,
      recipientPhoneMasked,
      recipientPhoneLast4,
      transactionId,
      dateTime,
      serviceFee,
      receiptUrl,
    };
  } catch (err) {
    console.error('[TelebirrParser] Parse error:', err);
    return null;
  }
}

module.exports = { parseTelebirrSms };
