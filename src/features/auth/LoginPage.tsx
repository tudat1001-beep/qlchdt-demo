import React, { useState } from 'react';
import { Smartphone, Lock, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ApiClientError } from '../../lib/api-client';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim()) {
      setErrorMessage('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu');
      return;
    }

    setIsLoading(true);
    try {
      await login({ username: username.trim(), password });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          setErrorMessage('Tên đăng nhập hoặc mật khẩu không chính xác');
        } else {
          setErrorMessage(err.message);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định khi đăng nhập');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon-badge">
            <Smartphone size={24} />
          </div>
          <h1 className="auth-title">Đăng nhập hệ thống</h1>
          <p className="auth-subtitle">Phần mềm quản trị cửa hàng điện thoại QLCHDT</p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fee2e2',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '12.5px',
              marginBottom: '16px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <Input
            label="Tên đăng nhập"
            id="login-username"
            name="username"
            type="text"
            required
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập tên đăng nhập quản trị"
          />

          <Input
            label="Mật khẩu"
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
          />

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            style={{ width: '100%', marginTop: '6px', padding: '9px 16px', fontSize: '14px' }}
          >
            <Lock size={16} />
            <span>Đăng nhập</span>
          </Button>
        </form>
      </div>
    </div>
  );
};
