/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Yanyan 中医语言主题
        paper: '#F7F4EE',
        ink: '#2A2A2A',
        // 火分 4 档配色
        'fire-ping': '#4A8B6F',
        'fire-mild': '#C9A227',
        'fire-mid':  '#D9762C',
        'fire-high': '#B43A30'
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Source Han Sans"',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
};
