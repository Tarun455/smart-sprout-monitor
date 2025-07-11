
import Header from '@/components/Header';
import Dashboard from '@/components/Dashboard';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/70">
      <Header />
      <main className="animate-fade-in pt-4 px-4">
        <Dashboard />
      </main>
    </div>
  );
};

export default Index;
