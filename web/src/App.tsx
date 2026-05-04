import { Route, Switch } from 'wouter';
import { Home } from './pages/Home';
import { Consent } from './pages/Consent';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Login } from './pages/Login';
import { Step1ReverseFilter } from './pages/Onboarding/Step1ReverseFilter';
import { Step2SymptomsGrid } from './pages/Onboarding/Step2SymptomsGrid';
import { Step3BaselineConsent } from './pages/Onboarding/Step3BaselineConsent';
import { Step4Welcome } from './pages/Onboarding/Step4Welcome';
import { Camera } from './pages/Camera';
import { MealResult } from './pages/MealResult';
import { RequireAuth } from './components/RequireAuth';

export function App() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />

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

      <Route path="/" component={Home} />

      <Route>
        <div className="p-8 text-center text-ink/60">页面不存在</div>
      </Route>
    </Switch>
  );
}
