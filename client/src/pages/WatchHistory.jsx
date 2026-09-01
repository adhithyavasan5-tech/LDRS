import { Clock } from 'lucide-react';
import Card from '../components/ui/Card';

const WatchHistory = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Watch History</h1>
        <p className="page-subtitle">Memories of movies watched together.</p>
      </div>

      <Card className="empty-state">
        <Clock className="empty-state-icon" />
        <h3 className="empty-state-title">No history yet</h3>
        <p className="empty-state-desc">Your watched movies will appear here. (Phase 4 feature)</p>
      </Card>
    </div>
  );
};

export default WatchHistory;
