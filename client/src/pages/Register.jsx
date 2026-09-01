import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Heart } from 'lucide-react';
import { userService } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    gender: '',
    age: '',
  });

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) return toast.error('Please enter your email');
    if (!formData.password || formData.password.length < 8)
      return toast.error('Password must be at least 8 characters');
    if (!formData.name.trim()) return toast.error('Please enter your name');
    if (!formData.gender) return toast.error('Please select your gender');
    if (!formData.age || isNaN(formData.age) || parseInt(formData.age) < 18)
      return toast.error('You must be at least 18 years old');

    try {
      setLoading(true);
      const res = await userService.createProfile({
        ...formData,
        age: parseInt(formData.age),
      });

      if (res.success) {
        toast.success(res.message);
        login(res.user, res.token);
        navigate('/home');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card-strong p-8">
      <div className="text-center mb-8">
        <Heart className="w-8 h-8 text-accent-500 mx-auto mb-3" fill="currentColor" />
        <h1 className="text-2xl font-display font-semibold mb-2">Create Your Space</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 underline">
            Sign in
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          placeholder="your@email.com"
          value={formData.email}
          onChange={handleChange}
          autoComplete="email"
        />

        <Input
          label="Password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={handleChange}
          autoComplete="new-password"
        />

        <Input
          label="Your Name"
          name="name"
          placeholder="Enter your name"
          value={formData.name}
          onChange={handleChange}
          autoComplete="off"
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Gender
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['male', 'female', 'other'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setFormData({ ...formData, gender: g })}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  formData.gender === g
                    ? 'bg-primary-600/20 text-primary-300 border border-primary-500/50'
                    : 'bg-white/5 border border-transparent hover:bg-white/10 text-gray-400'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Age"
          name="age"
          type="number"
          placeholder="Your age"
          min="18"
          max="120"
          value={formData.age}
          onChange={handleChange}
        />

        <Button type="submit" className="w-full mt-2" loading={loading}>
          Create Profile <Heart className="w-4 h-4 ml-1" />
        </Button>
      </form>

      <p className="text-xs text-center mt-6 opacity-60">
        By creating a profile, you confirm you are 18 or older.
      </p>
    </div>
  );
};

export default Register;
