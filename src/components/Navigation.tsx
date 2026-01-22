import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/system", label: "System" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#transparency", label: "Transparency" },
  { href: "#about", label: "About" },
];

export const Navigation = () => {
  const location = useLocation();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 nav-blur"
    >
      <nav className="container mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="relative">
            <Shield className="w-7 h-7 text-primary transition-all duration-300 group-hover:text-primary/80" />
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="font-semibold text-lg tracking-tight">
            CivicFix <span className="text-primary">AI</span>
          </span>
        </Link>

        {/* Center Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                location.pathname === link.href
                  ? "text-foreground bg-white/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <Link 
            to="/get-started" 
            className="btn-system-primary text-sm"
          >
            Get Started
          </Link>
        </div>
      </nav>
    </motion.header>
  );
};

