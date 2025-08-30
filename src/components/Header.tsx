
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Settings, Menu, X, Leaf, Camera } from 'lucide-react';
import { useState } from 'react';


const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);


  const navigateToDashboard = () => {
    navigate('/');
    if (expanded) setExpanded(false);
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard';
      case '/camera': return 'Camera';
      case '/settings': return 'Settings';
      default: return 'SmartSprout';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div
          className="flex items-center space-x-3 cursor-pointer group"
          onClick={navigateToDashboard}
          aria-label="Go to dashboard"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Leaf className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              SmartSprout
            </h1>
            <p className="text-xs text-muted-foreground mono">
              {getPageTitle()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              to="/"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all ${location.pathname === '/'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
            <Link
              to="/camera"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all ${location.pathname === '/camera'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
            >
              <Camera className="mr-2 h-4 w-4" />
              Camera
            </Link>
            <Link
              to="/settings"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all ${location.pathname === '/settings'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </nav>

          <button
            className="md:hidden flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {expanded && (
        <div className="md:hidden bg-background/95 backdrop-blur-xl border-t border-border/50 px-4 py-3 fade-in">
          <nav className="flex flex-col space-y-1">
            <Link
              to="/"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all ${location.pathname === '/'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              onClick={() => setExpanded(false)}
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
            <Link
              to="/camera"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all ${location.pathname === '/camera'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              onClick={() => setExpanded(false)}
            >
              <Camera className="mr-2 h-4 w-4" />
              Camera
            </Link>
            <Link
              to="/settings"
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all ${location.pathname === '/settings'
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              onClick={() => setExpanded(false)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
