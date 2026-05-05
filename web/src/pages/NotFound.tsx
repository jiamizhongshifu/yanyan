/**
 * 404 / 通用错误页 — 用 mascot-worried 兜底
 */
import { Link } from 'wouter';
import { asset } from '../services/assets';

interface Props {
  /** 自定义标题 */
  title?: string;
  /** 自定义描述 */
  description?: string;
  /** 主按钮目标(默认回首页) */
  ctaHref?: string;
  ctaLabel?: string;
}

export function NotFound({
  title = '页面找不到了',
  description = '可能链接过期了,或者你输错了网址。',
  ctaHref = '/app',
  ctaLabel = '回到今天'
}: Props) {
  return (
    <main className="min-h-screen bg-paper px-7 pt-24 pb-10 flex flex-col items-center text-center">
      <img
        src={asset('mascot-worried.png')}
        alt=""
        className="w-44 h-44 object-contain mb-4"
        loading="lazy"
      />
      <h1 className="text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-3 text-sm text-ink/60 leading-relaxed max-w-xs">{description}</p>
      <Link
        href={ctaHref}
        className="mt-10 inline-block rounded-full bg-ink text-white px-8 py-3 text-base font-medium"
      >
        {ctaLabel}
      </Link>
      <Link href="/" className="mt-4 text-xs text-ink/45 underline">
        回到落地页
      </Link>
    </main>
  );
}
