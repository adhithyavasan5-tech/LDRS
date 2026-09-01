import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, PlusCircle, LogIn, Calendar, Film, PlayCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { coupleService } from '../services/coupleService';
import Card, { StatCard } from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';

const Home = () => {
  const { user } = useAuth();
  const [coupleProfile, setCoupleProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.coupleProfileId) {
        setLoading(false);
        return;
      }
      try {
        const res = await coupleService.getProfile();
        if (res.success) setCoupleProfile(res.coupleProfile);
      } catch (err) {
        console.error('Failed to load couple profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const partner = coupleProfile 
    ? (coupleProfile.user1Id?._id === user._id ? coupleProfile.user2Id : coupleProfile.user1Id)
    : null;

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Welcome, {user?.name} <Heart className="inline w-6 h-6 text-accent-500 animate-pulse mb-1" fill="currentColor"/></h1>
        <p className="page-subtitle">Your private digital date space.</p>
      </div>

      {/* Primary Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        <Card className="flex items-center gap-5 bg-gradient-to-br from-primary-900/40 to-transparent border-primary-500/20">
          <div className="w-14 h-14 rounded-full bg-primary-500/20 flex items-center justify-center shrink-0 text-primary-400">
            <PlusCircle className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Create Movie Date</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Upload a movie and get a room code</p>
            <Link to="/create-room">
              <Button size="sm">Create Room</Button>
            </Link>
          </div>
        </Card>

        <Card className="flex items-center gap-5 bg-gradient-to-br from-accent-900/40 to-transparent border-accent-500/20">
          <div className="w-14 h-14 rounded-full bg-accent-500/20 flex items-center justify-center shrink-0 text-accent-400">
            <LogIn className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Join Movie Date</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Enter your partner's room code</p>
            <Link to="/join-room">
              <Button size="sm" variant="secondary">Join Room</Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Couple Overview */}
      <div className="section-header">
        <h2 className="section-title">Our Space</h2>
      </div>

      {!user?.coupleProfileId ? (
        <Card className="empty-state py-12 border-dashed">
          <Heart className="empty-state-icon" />
          <h3 className="empty-state-title">Waiting for your partner</h3>
          <p className="empty-state-desc">Create a room and invite your partner to connect your profiles permanently.</p>
        </Card>
      ) : loading ? (
        <div className="skeleton h-48 w-full" />
      ) : !coupleProfile ? (
        <Card className="empty-state py-12 border-dashed">
          <Heart className="empty-state-icon text-red-500" />
          <h3 className="empty-state-title text-red-400">Failed to load profile</h3>
          <p className="empty-state-desc">There was a problem loading your couple profile. Please try refreshing.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2 flex flex-col justify-center items-center py-8">
            <div className="flex items-center gap-4 mb-4">
              <Avatar name={user.name} size="lg" />
              <Heart className="w-6 h-6 text-accent-500" fill="currentColor" />
              <Avatar name={partner?.name} size="lg" />
            </div>
            <h3 className="text-xl font-display font-medium">
              {coupleProfile.coupleNickname || `${user.name} & ${partner?.name}`}
            </h3>
            {coupleProfile.daysTogether && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {coupleProfile.daysTogether} days together
              </p>
            )}
          </Card>
          
          <StatCard 
            icon={<Film className="text-primary-400" />}
            value={coupleProfile.totalMoviesWatched} 
            label="Movies Watched" 
          />
          
          <StatCard 
            icon={<Calendar className="text-accent-400" />}
            value={coupleProfile.lastMovieWatched ? 'Recently' : 'None yet'} 
            label="Last Movie Date" 
          />
        </div>
      )}

      {/* Quick Sections stub */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <div>
          <div className="section-header"><h2 className="section-title">Watchlist</h2></div>
          <Card className="empty-state py-8">
            <PlayCircle className="empty-state-icon w-8 h-8" />
            <p className="empty-state-desc mt-2">No movies in watchlist.</p>
          </Card>
        </div>
        <div>
          <div className="section-header"><h2 className="section-title">Up Next</h2></div>
          <Card className="empty-state py-8">
            <Calendar className="empty-state-icon w-8 h-8" />
            <p className="empty-state-desc mt-2">No upcoming reminders.</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;
