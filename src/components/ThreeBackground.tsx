export const ThreeBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/10 animate-pulse" 
           style={{ animationDuration: '8s' }} />
      
      {/* Large floating orbs */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '0s', animationDuration: '6s' }} />
      <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-accent/15 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '2s', animationDuration: '8s' }} />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '4s', animationDuration: '7s' }} />
      <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '1s', animationDuration: '9s' }} />
      <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-accent/10 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '3s', animationDuration: '10s' }} />
      
      {/* Smaller floating particles */}
      <div className="absolute top-1/4 left-1/2 w-32 h-32 bg-primary/30 rounded-full blur-2xl animate-float" 
           style={{ animationDelay: '0.5s', animationDuration: '5s' }} />
      <div className="absolute bottom-1/3 left-1/3 w-24 h-24 bg-accent/25 rounded-full blur-2xl animate-float" 
           style={{ animationDelay: '1.5s', animationDuration: '6s' }} />
      <div className="absolute top-2/3 right-1/3 w-40 h-40 bg-secondary/15 rounded-full blur-2xl animate-float" 
           style={{ animationDelay: '2.5s', animationDuration: '7s' }} />
    </div>
  );
};
