import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <header className="App-header">
          <h1>{{projectName}}</h1>
          <p>Built with AI Code Operating System</p>
        </header>
      </div>
    </ErrorBoundary>
  );
}

export default App;