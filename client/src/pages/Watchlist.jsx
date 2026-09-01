import { Bookmark } from 'lucide-react';
import Card from '../components/ui/Card';

const Watchlist = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Our Watchlist</h1>
        <p className="page-subtitle">Movies you plan to watch.</p>
      </div>

      <Card className="empty-state">
        <Bookmark className="empty-state-icon" />
        <h3 className="empty-state-title">Watchlist is empty</h3>
        <p className="empty-state-desc">Add movies you want to watch together. (Phase 4 feature)</p>
      </Card>
    </div>
  );
};

export default Watchlist;
