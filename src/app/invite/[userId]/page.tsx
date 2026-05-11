import { Metadata } from 'next';
import { redirect } from 'next/navigation';

type Props = {
  params: { userId: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const bannerUrl = 'https://bunabingo.vercel.app/banner.png';
  
  return {
    title: 'Join me on Buna Bingo! ☕️💰',
    description: 'Spin Wheel, Play, Win: The Royal Buna Way. Join now and we both earn a 5 ETB bonus!',
    openGraph: {
      title: 'Buna Bingo - Rich Flavor, Golden Wins ✨',
      description: '🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!',
      images: [{ url: bannerUrl, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Buna Bingo - Rich Flavor, Golden Wins ✨',
      description: '🎰 Join me on Buna Bingo! ☕️ We both get 5 ETB bonus!',
      images: [bannerUrl],
    },
  };
}

export default function InviteRedirectPage({ params }: Props) {
  // Redirect to the Telegram bot with the start parameter
  // We use a small delay or a button if needed, but a direct redirect is smoother.
  // Note: Telegram's crawler will see the metadata, but the user will be redirected.
  const botUsername = 'buna_bingobot';
  redirect(`https://t.me/${botUsername}?start=${params.userId}`);
  
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#3D2B1F', color: '#F5E6BE' }}>
      <div style={{ textAlign: 'center' }}>
        <h1>Redirecting to Buna Bingo...</h1>
        <p>Please wait while we take you to the bot.</p>
      </div>
    </div>
  );
}
