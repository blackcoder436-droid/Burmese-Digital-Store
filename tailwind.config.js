/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Purple/Cyan dual accent - Digital Store feel
        accent: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#6c5ce7',
          600: '#5b4bd5',
          700: '#4c3ec4',
          800: '#3b2fa3',
          900: '#2e2482',
        },
        // Secondary electric mapped to purple/cyan
        electric: {
          400: '#a78bfa',
          500: '#6c5ce7',
          600: '#5b4bd5',
        },
        // Dark backgrounds - purple-tinted near black
        dark: {
          950: '#0a0a1a',
          900: '#0e0e22',
          800: '#12122a',
          700: '#1a1a3e',
          600: '#252547',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(108, 92, 231, 0.15), transparent)',
        'card-shine': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)',
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(108, 92, 231, 0.15)',
        'glow': '0 0 30px rgba(108, 92, 231, 0.2)',
        'glow-lg': '0 0 60px rgba(108, 92, 231, 0.25)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 12px 48px rgba(0, 0, 0, 0.5), 0 0 24px rgba(108, 92, 231, 0.15)',
      },
      animation: {
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'vpn-float': 'vpn-float 6s ease-in-out infinite',
        'vpn-spin': 'vpn-spin 20s linear infinite',
        'vpn-spin-reverse': 'vpn-spin 30s linear infinite reverse',
        'vpn-pulse-node': 'vpn-pulse-node 3s ease-in-out infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(108, 92, 231, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(108, 92, 231, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'vpn-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'vpn-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'vpn-pulse-node': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.5)', opacity: '1' },
        },
        'vpn-fadeInUp': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
