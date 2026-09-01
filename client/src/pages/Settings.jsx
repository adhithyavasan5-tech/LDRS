import { Settings as SettingsIcon } from 'lucide-react';
import Card from '../components/ui/Card';
import { useTheme } from '../hooks/useTheme';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="page-container animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage app preferences.</p>
      </div>

      <Card className="max-w-md">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-primary-400" /> App Settings
        </h3>
        
        <div className="flex items-center justify-between py-3 border-b border-white/10">
          <div>
            <p className="font-medium">Theme Preference</p>
            <p className="text-sm text-gray-500">Current: {theme}</p>
          </div>
          <button 
            onClick={toggleTheme}
            className="px-3 py-1.5 rounded-lg bg-primary-600/20 text-primary-300 text-sm font-medium hover:bg-primary-600/30"
          >
            Toggle Theme
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
