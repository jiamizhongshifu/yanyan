/**
 * App 根组件 — U1 阶段为占位
 *
 * 后续 unit 接入:
 *   U3:Supabase Auth + 同意校验路由守卫
 *   U4:Onboarding 4 屏(/onboarding/step1..step4)
 *   U6:拍照页(/camera)+ 餐食结果(/meals/:id)
 *   U7:次晨打卡(/check-in)
 *   U10:主屏(/)
 */

import { Route, Switch } from 'wouter';
import { Home } from './pages/Home';

export function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route>
        {/* 404 占位 */}
        <div className="p-8 text-center text-ink/60">页面不存在</div>
      </Route>
    </Switch>
  );
}
