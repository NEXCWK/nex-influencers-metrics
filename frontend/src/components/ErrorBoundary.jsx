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
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
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
