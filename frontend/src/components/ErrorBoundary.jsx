import React from 'react';

// Catches render-time errors so a crash shows a friendly message
// instead of a blank white screen.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Render error caught by ErrorBoundary:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'var(--font, Arial, sans-serif)',
        }}>
          <div style={{
            maxWidth: 440,
            textAlign: 'center',
            background: 'white',
            border: '1px solid var(--border, #E5E5E5)',
            borderRadius: 12,
            padding: '40px 32px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--danger, #EF4444)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Algo deu errado
            </h1>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>
              Ocorreu um erro ao carregar esta página. Tente recarregar.
            </p>
            <button className="btn btn-primary" onClick={this.handleReload}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
