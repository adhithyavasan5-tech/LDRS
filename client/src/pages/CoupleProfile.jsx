import { Heart } from 'lucide-react';
import Card from '../components/ui/Card';

const CoupleProfile = () => {
  return (
    <div className="page-container animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Our Space</h1>
        <p className="page-subtitle">Manage your relationship profile and reminders.</p>
      </div>

      <Card className="empty-state">
        <Heart className="empty-state-icon text-accent-500" />
        <h3 className="empty-state-title">Couple Profile Options</h3>
        <p className="empty-state-desc">Set anniversaries, birthdays, and relationship details. (Phase 4 feature)</p>
      </Card>
    </div>
  );
};

export default CoupleProfile;
