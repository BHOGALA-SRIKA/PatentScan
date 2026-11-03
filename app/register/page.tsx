'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed.');
        return;
      }

      router.push('/login?registered=1');
    } catch {
      setError('Unable to connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f4f6f9',
      padding: '24px'
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%',
        maxWidth: '420px',
        background: '#fff',
        padding: '32px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>
          Create Account
        </h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          Register as a PatentScan user.
        </p>

        <label>Full Name</label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Enter your full name"
          style={inputStyle}
        />

        <label>Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          style={inputStyle}
        />

        <label>Password</label>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          style={inputStyle}
        />

        {error && (
          <p style={{ color: '#dc2626', marginBottom: '16px' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            marginTop: '12px'
          }}
        >
          {loading ? 'Creating Account...' : 'Register'}
        </button>

        <p style={{ marginTop: '20px', textAlign: 'center' }}>
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '11px',
  marginTop: '7px',
  marginBottom: '18px',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  boxSizing: 'border-box'
};
