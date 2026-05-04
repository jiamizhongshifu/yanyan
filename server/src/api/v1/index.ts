/**
 * v1 路由汇总
 *
 * 后续 unit 在此追加:
 *   U3:  consents       (单独同意 + 撤回)
 *   U4:  onboarding     (反向定位 / baseline / 同意)
 *   U6:  meals          (拍照 + 食物分类)
 *   U7:  symptoms       (次晨打卡)
 *   U8:  yan-score      (火分 / 归因)
 *   U10: dashboard      (主屏聚合)
 *   U12: events         (埋点上报)
 *   U13a:recommendations(今日推荐)
 *   U13b:profile-pdf    (体质档案 PDF)
 */

import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health';
import { registerConsentsRoutes, type RegisterConsentsOptions } from './consents';
import { registerOnboardingRoutes, type RegisterOnboardingOptions } from './onboarding';

export interface V1Options {
  consents?: RegisterConsentsOptions;
  onboarding?: RegisterOnboardingOptions;
}

export async function registerV1(app: FastifyInstance, opts: V1Options = {}): Promise<void> {
  await registerHealthRoutes(app);
  await registerConsentsRoutes(app, opts.consents);
  await registerOnboardingRoutes(app, opts.onboarding);
}
