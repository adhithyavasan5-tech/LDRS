import { Link } from 'react-router-dom';
import { HeartCrack } from 'lucide-react';
import Button from '../components/ui/Button';

const NotFound = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <HeartCrack className="w-16 h-16 text-primary-500/50 mb-6" />
      <h1 className="text-4xl font-display font-medium mb-2">Are we lost?</h1>
      <p className="text-gray-400 mb-8 max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/home">
        <Button>Find our way home</Button>
      </Link>
    </div>
  );
};

export default NotFound;
