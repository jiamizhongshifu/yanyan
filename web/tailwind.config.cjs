/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ⚠️ 改色时必须同步 src/theme/palette.ts(PostCSS 编译期不能 import TS 模块,
        //    所以这里保留字面量 — palette.ts 是 SVG 组件的运行时来源)
        paper: '#F7F4EE',
        ink: '#2A2A2A',
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
      },
      keyframes: {
        fadein: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      },
      animation: {
        fadein: 'fadein 0.4s ease-out'
      }
    }
  },
  plugins: []
};
