
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Settings, ChevronRight, Leaf, Camera } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const isMobile = useIsMobile();

  useEffect(() => {
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(timeInterval);
    };
  }, []);
  
  const navigateToDashboard = () => {
    navigate('/');
    if (expanded) setExpanded(false);
  };
  
  return (
    <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border shadow-md mb-6">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div 
          className="flex items-center space-x-3 cursor-pointer" 
          onClick={navigateToDashboard}
          aria-label="Go to dashboard"
        >
          <div 
            className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-teal-400 flex items-center justify-center shadow-md"
          >
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-500 to-teal-400">SmartSprout</span>
            </h1>
            <p className="text-xs text-muted-foreground">Greenhouse Monitoring</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center space-x-2">
            <Link 
              to="/" 
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/' 
                  ? 'bg-accent text-primary font-semibold' 
                  : 'text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
            <Link 
              to="/camera" 
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/camera' 
                  ? 'bg-accent text-primary font-semibold' 
                  : 'text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              <Camera className="mr-2 h-4 w-4" />
              Camera
            </Link>
            <Link 
              to="/settings" 
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/settings' 
                  ? 'bg-accent text-primary font-semibold' 
                  : 'text-muted-foreground hover:bg-secondary/80'
              }`}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </nav>

          <button 
            className="md:hidden flex items-center justify-center p-2 rounded-full text-muted-foreground hover:bg-secondary/80"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight className={`h-5 w-5 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      {expanded && (
        <div className="md:hidden bg-background border-t border-border px-4 py-3 animate-fade-in shadow-inner">
          <nav className="flex flex-col space-y-2">
            <Link 
              to="/" 
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/' 
                  ? 'bg-accent text-primary font-semibold' 
                  : 'text-muted-foreground hover:bg-secondary/80'
              }`}
              onClick={() => setExpanded(false)}
            >
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
            <Link 
              to="/camera" 
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/camera' 
                  ? 'bg-accent text-primary font-semibold' 
                  : 'text-muted-foreground hover:bg-secondary/80'
              }`}
              onClick={() => setExpanded(false)}
            >
              <Camera className="mr-2 h-4 w-4" />
              Camera
            </Link>
            <Link 
              to="/settings" 
              className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/settings' 
                  ? 'bg-accent text-primary font-semibold' 
                  : 'text-muted-foreground hover:bg-secondary/80'
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
