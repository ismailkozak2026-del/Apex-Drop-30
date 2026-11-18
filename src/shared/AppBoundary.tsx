import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; title?: string },
  State
> {
  constructor(props: { children: React.ReactNode; title?: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Beklenmeyen bir uygulama hatası oluştu.',
    };
  }

  override componentDidCatch(error: Error) {
    console.error('AppBoundary caught:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#0d0f14] p-6 text-slate-100">
          <div className="w-full max-w-lg rounded-xl border border-rose-500/40 bg-slate-900 p-6">
            <h2 className="font-display text-xl font-bold text-rose-400">
              {this.props.title || 'Bağlantı veya Yetki Hatası'}
            </h2>
            <p className="mt-3 break-words text-sm text-slate-300">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
