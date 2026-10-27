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
        <div className="empty-state" style={{ minHeight: '60vh' }} role="alert">
          <div className="empty-state-icon" style={{ color: 'var(--danger)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <p className="empty-state-title">Algo deu errado</p>
          <p className="empty-state-text">Ocorreu um erro ao carregar esta página. Tente recarregar.</p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
