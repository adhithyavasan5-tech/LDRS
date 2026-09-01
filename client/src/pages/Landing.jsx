import { Link } from 'react-router-dom';
import { Heart, Play, Video, MessageCircle } from 'lucide-react';
import Button from '../components/ui/Button';

const FeatureCard = ({ icon: Icon, title, desc }) => (
  <div className="glass-card p-6 flex flex-col items-center text-center gap-3">
    <div className="w-12 h-12 rounded-full bg-primary-900/30 flex items-center justify-center text-primary-400 mb-2">
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{desc}</p>
  </div>
);

const Landing = () => {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundImage: 'var(--tw-bg-hero-dark)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 group">
          <Heart className="w-6 h-6 text-accent-500" fill="currentColor" />
          <span className="font-display text-2xl font-medium gradient-text">LDRS</span>
        </div>
        <Link to="/login">
          <Button variant="ghost">Sign In</Button>
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-500/30 bg-primary-900/20 text-primary-300 text-xs font-medium mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          The private digital date space
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-medium mb-6 max-w-4xl tracking-tight leading-tight animate-fade-up">
          Break the distance, <br />
          <span className="gradient-text-warm italic">together in every moment.</span>
        </h1>
        
        <p className="text-lg md:text-xl mb-10 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
          A premium sanctuary for long-distance couples to watch movies, video call, and preserve shared memories.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 animate-scale-in">
          <Link to="/register">
            <Button size="lg" className="w-full sm:w-auto">Create Your Space ❤️</Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 max-w-5xl mx-auto px-4 w-full">
          <FeatureCard 
            icon={Play} 
            title="Synced Movie Player" 
            desc="Perfectly synchronized playback. When you pause for snacks, it pauses for them too."
          />
          <FeatureCard 
            icon={Video} 
            title="Floating Video Call" 
            desc="See their reactions in real-time with an elegant picture-in-picture video call."
          />
          <FeatureCard 
            icon={MessageCircle} 
            title="Real-time Chat" 
            desc="Share quick thoughts and reactions while the movie plays without missing a beat."
          />
        </div>
      </main>
    </div>
  );
};

export default Landing;
