import { Component } from 'react';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(JSON.stringify({ level: 'error', event: 'react_render_error', errorName: error?.name || 'Error' }));
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="fatal-error" role="alert"><p>Tuning Hub</p><h1>No hemos podido mostrar esta pantalla</h1><p>Tus datos no se han eliminado. Recarga la aplicación para volver a intentarlo.</p><button type="button" onClick={() => window.location.reload()}>Recargar</button></main>;
  }
}
