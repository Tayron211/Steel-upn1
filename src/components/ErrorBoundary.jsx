import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 my-4 bg-white dark:bg-[#0c0c10] border border-rose-200 dark:border-rose-900/60 rounded-3xl shadow-sm text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 stroke-[2]" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Se produjo un problema al cargar esta vista
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4 break-words">
            {this.state.error?.message || 'Error inesperado de renderizado.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FDBA30] text-slate-950 font-bold text-xs rounded-xl shadow-xs hover:bg-[#ffc642] active:scale-95 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 stroke-[2.4]" />
            <span>Reintentar</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
