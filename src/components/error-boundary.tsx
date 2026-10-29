import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Card } from './ui';
import { RefreshIcon } from './icons';

interface Props {
  children: ReactNode;
  /** 页面标识,切换页面时自动清除旧错误 */
  page: string;
}

interface State {
  error: Error | null;
}

/** 页面级异常兜底:单页渲染出错时显示重试界面,而不是整站白屏 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[hot-radar] ${this.props.page} 页面渲染异常`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (prev.page !== this.props.page && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm font-black text-ink">页面出了点问题,内容渲染失败</p>
          <p className="mt-1 truncate font-mono text-xs font-bold text-muted" title={String(this.state.error)}>
            {this.state.error.message}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" onClick={() => this.setState({ error: null })}>
              重试
            </Button>
            <Button size="sm" variant="secondary" onClick={() => location.reload()}>
              <RefreshIcon className="size-3.5" /> 重新加载
            </Button>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}
