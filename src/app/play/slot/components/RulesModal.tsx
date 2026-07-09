import { X } from 'lucide-react';

interface RulesModalProps {
  onClose: () => void;
}

export default function RulesModal({ onClose }: RulesModalProps) {
  return (
    // z-[200] ensures it sits above the bottom navbar (z-50) and any other overlays
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-[#0a2e1f] to-[#041a10] rounded-t-2xl w-full max-w-sm border border-[#22c55e]/30 shadow-2xl relative flex flex-col"
        style={{ maxHeight: 'calc(100vh - 80px)' }} // 80px = navbar height — never goes behind it
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
          <h2 className="text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 italic uppercase tracking-wider">
            Multi Hot 5 እንዴት እንደሚጫወቱ
          </h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors ml-2 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="space-y-3 text-sm text-gray-200 pb-2">

            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <h3 className="font-bold text-[#4ade80] mb-1 uppercase text-xs tracking-wider">🎯 ዓላማው (The Goal)</h3>
              <p className="text-xs leading-relaxed opacity-90">
                በማናቸውም 5 መስመሮች ላይ 3 ተመሳሳይ ምልክቶችን ለማግኘት ስፒን ያድርጉ።
              </p>
            </div>

            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <h3 className="font-bold text-[#a78bfa] mb-1 uppercase text-xs tracking-wider">✨ 5 የማሸነፊያ መስመሮች (Paylines)</h3>
              <p className="text-xs leading-relaxed opacity-90">
                3 አግድም (ከላይ፣ መሀል፣ ከታች) እና 2 ሰያፍ (ከዳር እስከ ዳር) መስመሮች አሉት። ከነዚህ በአንዱ ላይ 3 ተመሳሳይ ምልክቶች ከወጡ ያሸንፋሉ!
              </p>
            </div>

            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <h3 className="font-bold text-[#facc15] mb-1 uppercase text-xs tracking-wider">⚡ ማባዣ (Multiplier)</h3>
              <p className="text-xs leading-relaxed opacity-90">
                ካሸነፉ በኋላ ከታች ያለው ልዩ ማባዣ ይሽከረከራል። አጠቃላይ ያሸነፉት ገንዘብ ባረፈበት ቁጥር ይባዛል (እስከ 5x!)።
              </p>
            </div>

            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <h3 className="font-bold text-[#60a5fa] mb-1 uppercase text-xs tracking-wider">🎲 የዕድል ጨዋታ (Gamble)</h3>
              <p className="text-xs leading-relaxed opacity-90">
                ካሸነፉ በኋላ 'GAMBLE' የሚለውን መምረጥ ይችላሉ። የተደበቀውን ካርድ ቀለም (ቀይ/ጥቁር) ከገመቱ ያሸነፉት 2x ይሆናል፣ አይነቱን ከገመቱ ደግሞ 4x ይሆናል! ከተሳሳቱ ግን ያሸነፉትን ያጣሉ።
              </p>
            </div>

            <div className="bg-black/30 p-3 rounded-xl border border-white/5">
              <h3 className="font-bold text-white mb-1 uppercase text-xs tracking-wider">🍒 ምልክቶች እና ክፍያዎች</h3>
              <ul className="text-xs leading-relaxed opacity-90 space-y-1 mt-2">
                <li className="flex justify-between"><span>7️⃣ 7 (Sevens)</span> <span className="font-bold text-yellow-400">100x</span></li>
                <li className="flex justify-between"><span>⭐ ኮከብ (Stars)</span> <span className="font-bold text-yellow-400">50x</span></li>
                <li className="flex justify-between"><span>🔔 ቃጭል (Bells)</span> <span className="font-bold text-yellow-400">25x</span></li>
                <li className="flex justify-between"><span>🍉 ሀብሀብ (Watermelon)</span> <span className="font-bold text-yellow-400">15x</span></li>
                <li className="flex justify-between"><span>🍇 ወይን (Grapes)</span> <span className="font-bold text-yellow-400">10x</span></li>
                <li className="flex justify-between"><span>🍊 ብርቱካን (Oranges)</span> <span className="font-bold text-yellow-400">5x</span></li>
                <li className="flex justify-between"><span>🍋 ሎሚ (Lemons)</span> <span className="font-bold text-yellow-400">3x</span></li>
                <li className="flex justify-between"><span>🍒 ቼሪ (Cherries)</span> <span className="font-bold text-yellow-400">2x</span></li>
              </ul>
            </div>

          </div>
        </div>

        {/* Sticky confirm button — always visible above navbar */}
        <div className="p-4 pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-black py-3 rounded-xl shadow-[0_4px_0_#166534] active:translate-y-1 active:shadow-none transition-all tracking-wider"
          >
            ገብቶኛል፣ እንጀምር!
          </button>
        </div>
      </div>
    </div>
  );
}
