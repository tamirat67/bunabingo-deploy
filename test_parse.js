require('ts-node/register');
const { parseTelebirrSms } = require('./backend/src/services/bunafrankValidator.ts');

const amharicSms = `ውድCHIROTAW
ወደ Luel Gebrelibanos(+251****55111)
150.00 ብር በ 08/07/2026 13:34:34
ልከዋል:: የሂሳብ እንቅስቃሴ ቁጥርዎ
DG88NERGX0 ነው:: የአገልግሎት ክፍያው
1.74 ብር ፤ የአገልግሎት ክፍያው 15% VAT
0.26 ብር ነው:: አሁን ያለዎት ቀሪ ሂሳብ 6.62 ብር
ነው:: የክፍያ መረጃዎን ለማግኘት ማሰፈንጠሪያውን
ይጫኑ: https://transactioninfo.ethiotelecom.et/receipt/DG88NERGX0
በቴሌብር ስለተገለገሉ እናመሰግናለን
ኢትዮ ቴሌኮም`;

const englishSms = `English
Dear CHIROTAW
You sent 150.00 Birr to Luel Gebrelibanos (+251****55111) on 08/07/2026 13:34:34. Your Account Activity Number is DG88NERGX0. The service fee is 1.74 Birr; The service charge is 15% VAT 0.26 Birr. Your current balance is 6.62 Birr. Click the button to access your payment information: https://transactioninfo.ethiotelecom.et/receipt/DG88NERGX0
Thank you for using Telebr
Ethio Telecom`;

console.log('Amharic:', parseTelebirrSms(amharicSms));
console.log('English:', parseTelebirrSms(englishSms));
