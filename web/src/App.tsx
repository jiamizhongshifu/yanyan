import { Route, Switch, useLocation } from 'wouter';
import { Landing } from './pages/Landing';
import { QuizStep1Goal } from './pages/Quiz/Step1Goal';
import { QuizStep2Symptoms } from './pages/Quiz/Step2Symptoms';
import { QuizStep3Lifestyle } from './pages/Quiz/Step3Lifestyle';
import { QuizResult } from './pages/Quiz/Result';
import { Home } from './pages/Home';
import { Today } from './pages/Today';
import { Insights } from './pages/Insights';
import { Findings } from './pages/Findings';
import { Me } from './pages/Me';
import { HealthShortcut } from './pages/HealthShortcut';
import { Consent } from './pages/Consent';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Login } from './pages/Login';
import { Step1ReverseFilter } from './pages/Onboarding/Step1ReverseFilter';
import { Step2SymptomsGrid } from './pages/Onboarding/Step2SymptomsGrid';
import { Step3BaselineConsent } from './pages/Onboarding/Step3BaselineConsent';
import { Step4Welcome } from './pages/Onboarding/Step4Welcome';
import { Camera } from './pages/Camera';
import { MealResult } from './pages/MealResult';
import { Step1Blind } from './pages/MorningCheckin/Step1Blind';
import { Step2Compare } from './pages/MorningCheckin/Step2Compare';
import { Step3Reveal } from './pages/MorningCheckin/Step3Reveal';
import { ProfilePdf } from './pages/ProfilePdf';
import { RequireAuth } from './components/RequireAuth';
import { BottomTabs } from './components/BottomTabs';
import { InstallPrompt } from './components/InstallPrompt';

/** 登录后主屏 + 3 tab 在以下前缀显示 */
const TAB_VISIBLE_PREFIXES = ['/app', '/findings', '/me'];

function MaybeBottomTabs() {
  const [location] = useLocation();
  const visible = TAB_VISIBLE_PREFIXES.some((p) => location === p || location.startsWith(p + '/') || location === p);
  return visible ? <BottomTabs /> : null;
}

export function App() {
  return (
    <>
      <Switch>
        {/* 公开 — 落地页 + 公开 quiz(无 RequireAuth) */}
        <Route path="/" component={Landing} />
        <Route path="/quiz/step1" component={QuizStep1Goal} />
        <Route path="/quiz/step2" component={QuizStep2Symptoms} />
        <Route path="/quiz/step3" component={QuizStep3Lifestyle} />
        <Route path="/quiz/result" component={QuizResult} />

        {/* 登录 / 隐私政策 — 公开 */}
        <Route path="/login" component={Login} />
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
          <div className="p-8 text-center text-ink/60">页面不存在</div>
        </Route>
      </Switch>
      <MaybeBottomTabs />
      <InstallPrompt />
    </>
  );
}
