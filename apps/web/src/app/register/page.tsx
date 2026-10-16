import { RegisterForm } from '@/components/RegisterForm';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-theme-control"><ThemeToggle /></div>
      <div className="auth-form-wrap">
        <RegisterForm />
      </div>
    </div>
  );
}
