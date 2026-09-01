import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Heart } from 'lucide-react';
import { userService } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) return toast.error('Please enter your email');
    if (!formData.password) return toast.error('Please enter your password');

    try {
      setLoading(true);
      const res = await userService.login(formData);

      if (res.success) {
        toast.success('Welcome back! ❤️');
        login(res.user, res.token);
        navigate('/home');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card-strong p-8">
      <div className="text-center mb-8">
        <Heart className="w-8 h-8 text-accent-500 mx-auto mb-3" fill="currentColor" />
        <h1 className="text-2xl font-display font-semibold mb-2">Welcome Back</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-400 hover:text-primary-300 underline">
            Create one
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
          placeholder="Your password"
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
        />

        <Button type="submit" className="w-full mt-2" loading={loading}>
          Sign In <Heart className="w-4 h-4 ml-1" />
        </Button>
      </form>
    </div>
  );
};

export default Login;
