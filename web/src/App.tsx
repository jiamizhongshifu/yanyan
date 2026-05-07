import { Suspense, lazy } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { RequireAuth } from './components/RequireAuth';
import { BottomTabs } from './components/BottomTabs';
import { InstallPrompt } from './components/InstallPrompt';

/**
 * 路由级 code-split:除 Landing / Login / NotFound 外全部懒加载。
 * 用 .then(m => ({ default: m.Named })) 适配 named export → React.lazy 要求的 default。
 */
const QuizStep1Goal = lazy(() => import('./pages/Quiz/Step1Goal').then((m) => ({ default: m.QuizStep1Goal })));
const QuizStep2Symptoms = lazy(() => import('./pages/Quiz/Step2Symptoms').then((m) => ({ default: m.QuizStep2Symptoms })));
const QuizStep3Lifestyle = lazy(() => import('./pages/Quiz/Step3Lifestyle').then((m) => ({ default: m.QuizStep3Lifestyle })));
const QuizResult = lazy(() => import('./pages/Quiz/Result').then((m) => ({ default: m.QuizResult })));
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Today = lazy(() => import('./pages/Today').then((m) => ({ default: m.Today })));
const Insights = lazy(() => import('./pages/Insights').then((m) => ({ default: m.Insights })));
const Findings = lazy(() => import('./pages/Findings').then((m) => ({ default: m.Findings })));
const Me = lazy(() => import('./pages/Me').then((m) => ({ default: m.Me })));
const HealthShortcut = lazy(() => import('./pages/HealthShortcut').then((m) => ({ default: m.HealthShortcut })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then((m) => ({ default: m.AuthCallback })));
const Consent = lazy(() => import('./pages/Consent').then((m) => ({ default: m.Consent })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const Step1ReverseFilter = lazy(() => import('./pages/Onboarding/Step1ReverseFilter').then((m) => ({ default: m.Step1ReverseFilter })));
const Step2SymptomsGrid = lazy(() => import('./pages/Onboarding/Step2SymptomsGrid').then((m) => ({ default: m.Step2SymptomsGrid })));
const Step3BaselineConsent = lazy(() => import('./pages/Onboarding/Step3BaselineConsent').then((m) => ({ default: m.Step3BaselineConsent })));
const Step4Welcome = lazy(() => import('./pages/Onboarding/Step4Welcome').then((m) => ({ default: m.Step4Welcome })));
const Camera = lazy(() => import('./pages/Camera').then((m) => ({ default: m.Camera })));
const MealResult = lazy(() => import('./pages/MealResult').then((m) => ({ default: m.MealResult })));
const Step1Blind = lazy(() => import('./pages/MorningCheckin/Step1Blind').then((m) => ({ default: m.Step1Blind })));
const Step2Compare = lazy(() => import('./pages/MorningCheckin/Step2Compare').then((m) => ({ default: m.Step2Compare })));
const Step3Reveal = lazy(() => import('./pages/MorningCheckin/Step3Reveal').then((m) => ({ default: m.Step3Reveal })));
const ProfilePdf = lazy(() => import('./pages/ProfilePdf').then((m) => ({ default: m.ProfilePdf })));

/** 登录后主屏 + 3 tab 在以下前缀显示 */
const TAB_VISIBLE_PREFIXES = ['/app', '/findings', '/me'];

function MaybeBottomTabs() {
  const [location] = useLocation();
  const visible = TAB_VISIBLE_PREFIXES.some((p) => location === p || location.startsWith(p + '/') || location === p);
  return visible ? <BottomTabs /> : null;
}

/** 懒加载切换时的过渡占位 — 极简,避免视觉跳动 */
function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <span className="text-xs text-ink/30">加载中…</span>
    </div>
  );
}

export function App() {
  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          {/* 公开 — 落地页 + 公开 quiz(无 RequireAuth) */}
          <Route path="/" component={Landing} />
          <Route path="/quiz/step1" component={QuizStep1Goal} />
          <Route path="/quiz/step2" component={QuizStep2Symptoms} />
          <Route path="/quiz/step3" component={QuizStep3Lifestyle} />
          <Route path="/quiz/result" component={QuizResult} />

          {/* 登录 / 隐私政策 — 公开 */}
          <Route path="/login" component={Login} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/privacy-policy" component={PrivacyPolicy} />

          {/* 受保护 — 3 tab 主屏 */}
          <Route path="/app">
            <RequireAuth>
              <Today />
            </RequireAuth>
          </Route>
          <Route path="/app/body">
            <RequireAuth>
              <Home />
            </RequireAuth>
          </Route>
          <Route path="/app/insights">
            <RequireAuth>
              <Insights />
            </RequireAuth>
          </Route>

          {/* 受保护 — onboarding 4 屏 */}
          <Route path="/onboarding/step1">
            <RequireAuth>
              <Step1ReverseFilter />
            </RequireAuth>
          </Route>
          <Route path="/onboarding/step2">
            <RequireAuth>
              <Step2SymptomsGrid />
            </RequireAuth>
          </Route>
          <Route path="/onboarding/step3">
            <RequireAuth>
              <Step3BaselineConsent />
            </RequireAuth>
          </Route>
          <Route path="/onboarding/step4">
            <RequireAuth>
              <Step4Welcome />
            </RequireAuth>
          </Route>

          <Route path="/consent">
            <RequireAuth>
              <Consent />
            </RequireAuth>
          </Route>

          <Route path="/camera">
            <RequireAuth>
              <Camera />
            </RequireAuth>
          </Route>
          <Route path="/meals/:id">
            <RequireAuth>
              <MealResult />
            </RequireAuth>
          </Route>

          <Route path="/check-in/step1">
            <RequireAuth>
              <Step1Blind />
            </RequireAuth>
          </Route>
          <Route path="/check-in/step2">
            <RequireAuth>
              <Step2Compare />
            </RequireAuth>
          </Route>
          <Route path="/check-in/reveal">
            <RequireAuth>
              <Step3Reveal />
            </RequireAuth>
          </Route>

          <Route path="/findings">
            <RequireAuth>
              <Findings />
            </RequireAuth>
          </Route>
          <Route path="/profile-pdf">
            <RequireAuth>
              <ProfilePdf />
            </RequireAuth>
          </Route>
          <Route path="/me">
            <RequireAuth>
              <Me />
            </RequireAuth>
          </Route>
          <Route path="/me/health-shortcut">
            <RequireAuth>
              <HealthShortcut />
            </RequireAuth>
          </Route>

          <Route>
            <NotFound />
          </Route>
        </Switch>
      </Suspense>
      <MaybeBottomTabs />
      <InstallPrompt />
    </>
  );
}
