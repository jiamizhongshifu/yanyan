// API 层 wrapper
// 职责:统一 base URL / 鉴权 token / 错误处理 / 失败降级文案
//
// 实施约束:
// - 后续 U2 后端上线后接入 token 鉴权(微信 wx.login → code2session → 后端签发 token)
// - 后续 U3 同意版本校验在 onLaunch / onShow 时调用 GET /consents/current
// - 拍照、体感打卡、Yan-Score 等具体 API 在各自 unit 中实现,本文件提供基础 request 工具

interface RequestOptions {
  url: string; // 相对路径,自动拼接 baseUrl
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: WechatMiniprogram.IAnyObject | string | ArrayBuffer;
  header?: Record<string, string>;
  timeout?: number;
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
  status: number;
}

interface ApiFailure {
  ok: false;
  error: string;
  status: number;
  /**
   * 用户可见的降级文案(对应 plan U1 测试场景:网络不通时显示降级文案)
   * 永远不暴露后端原始错误堆栈
   */
  fallbackMessage: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const DEFAULT_TIMEOUT_MS = 8000;

export function getApiBaseUrl(): string {
  const app = getApp<{ globalData: { apiBaseUrl: string } }>();
  return app.globalData.apiBaseUrl;
}

/**
 * 统一 request wrapper
 * - 自动拼接 baseUrl
 * - 8 秒默认超时
 * - 失败时返回 user-friendly fallbackMessage
 *
 * 不在此处做埋点(U12 接入);不在此处做敏感字段加密(后端职责,见 plan U2 envelope encryption)
 */
export function request<T>(opts: RequestOptions): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    wx.request({
      url: getApiBaseUrl() + opts.url,
      method: opts.method ?? 'GET',
      data: opts.data,
      header: { 'Content-Type': 'application/json', ...(opts.header ?? {}) },
      timeout: opts.timeout ?? DEFAULT_TIMEOUT_MS,
      success: (res) => {
        const status = res.statusCode;
        if (status >= 200 && status < 300) {
          resolve({ ok: true, data: res.data as T, status });
        } else {
          resolve({
            ok: false,
            error: `http_${status}`,
            status,
            fallbackMessage: status >= 500 ? '服务忙,请稍后再试' : '请求异常,请稍后再试'
          });
        }
      },
      fail: (err) => {
        // 网络不通 / 超时 / DNS 失败统一降级
        resolve({
          ok: false,
          error: err.errMsg || 'network_error',
          status: 0,
          fallbackMessage: '网络不通,请检查后重试'
        });
      }
    });
  });
}
