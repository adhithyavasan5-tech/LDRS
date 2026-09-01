import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Hash, Lock, LogIn } from 'lucide-react';
import { roomService } from '../services/roomService';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const JoinRoom = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    roomCode: '',
    password: '',
  });

  const handleChange = (e) => {
    // Force room code to uppercase and max 6 chars
    const value = e.target.name === 'roomCode' 
      ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
      : e.target.value;
      
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.roomCode.length !== 6) return toast.error('Room code must be 6 characters');
    if (!formData.password) return toast.error('Password is required');

    try {
      setLoading(true);
      const res = await roomService.joinRoom(formData);
      
      if (res.success) {
        toast.success(res.message);
        navigate(`/watch/${res.room.roomCode}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container max-w-2xl animate-fade-in flex flex-col justify-center min-h-[70vh]">
      <div className="mb-8 text-center">
        <h1 className="page-title mb-2">Join Movie Date</h1>
        <p className="page-subtitle">Enter the code provided by your partner.</p>
      </div>

      <Card className="p-6 md:p-8 max-w-md mx-auto w-full border-accent-500/20">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Room Code"
            name="roomCode"
            placeholder="e.g. AB7K92"
            value={formData.roomCode}
            onChange={handleChange}
            leftIcon={<Hash className="w-4 h-4" />}
            autoComplete="off"
            className="font-mono uppercase tracking-widest text-lg"
          />

          <Input
            label="Room Password"
            name="password"
            type="password"
            placeholder="Enter the secret password"
            value={formData.password}
            onChange={handleChange}
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <div className="pt-2">
            <Button type="submit" size="lg" className="w-full btn-secondary text-white border-accent-500/50 hover:border-accent-400 bg-accent-900/20 hover:bg-accent-900/40" loading={loading}>
              <LogIn className="w-4 h-4 mr-2" /> Join Movie Date
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default JoinRoom;
