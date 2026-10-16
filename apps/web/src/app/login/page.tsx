import { LoginForm } from '@/components/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-theme-control"><ThemeToggle /></div>
      <div className="auth-form-wrap">
        <LoginForm />
      </div>
    </div>
  );
}
