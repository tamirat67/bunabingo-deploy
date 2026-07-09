import { parseTelebirrSms } from './src/services/bunafrankValidator';

const oromoSms = "Kabajamoo Tamirat Gara Luel Gebrelibanos (2519****5111)tti Qarshii 10.00 gaafa guyyaa 09/07/2026 14:28:06 ergitanii. Lakkoofsi sochii maallaqaa keessan DG900I6QE2 dha.";

const amharicSms = "ውድ Tamirat ወደ Luel Gebrelibanos (2519****5111) 10.00 ብር በ 09/07/2026 14:28:06 አስተላልፈዋል። የክፍያ ቁጥርዎ DG900I6QE2 ነው።";

console.log("--- OROMO ---");
console.log(parseTelebirrSms(oromoSms));

console.log("--- AMHARIC ---");
console.log(parseTelebirrSms(amharicSms));
