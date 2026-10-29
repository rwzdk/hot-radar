import { useHashRoute } from './lib/router';
import { NoticesProvider } from './lib/notices';
import { Shell } from './components/shell';
import { ErrorBoundary } from './components/error-boundary';
import BoardsPage from './pages/boards';
import MonitorPage from './pages/monitor';
import SearchPage from './pages/search';
import SettingsPage from './pages/settings';

export default function App() {
  const [route, navigate] = useHashRoute();

  return (
    <NoticesProvider>
      <Shell page={route.page} navigate={navigate}>
        <ErrorBoundary page={route.page}>
          {route.page === 'boards' && <BoardsPage />}
          {route.page === 'monitor' && <MonitorPage params={route.params} navigate={navigate} />}
          {route.page === 'search' && <SearchPage />}
          {route.page === 'settings' && <SettingsPage />}
        </ErrorBoundary>
      </Shell>
    </NoticesProvider>
  );
}
