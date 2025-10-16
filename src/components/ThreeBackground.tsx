export const ThreeBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 animate-pulse" 
           style={{ animationDuration: '8s' }} />
      
      {/* Floating orbs with CSS animations */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '0s', animationDuration: '6s' }} />
      <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '2s', animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '4s', animationDuration: '7s' }} />
      <div className="absolute top-2/3 right-1/3 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '1s', animationDuration: '9s' }} />
    </div>
  );
};
