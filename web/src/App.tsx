import { Route, Switch } from 'wouter';
import { Home } from './pages/Home';
import { Consent } from './pages/Consent';
import { PrivacyPolicy } from './pages/PrivacyPolicy';

export function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/consent" component={Consent} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route>
        <div className="p-8 text-center text-ink/60">页面不存在</div>
      </Route>
    </Switch>
  );
}
