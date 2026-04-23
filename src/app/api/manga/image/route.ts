import { NextRequest, NextResponse } from 'next/server';

import { getAuthorizedUsername } from '../_utils';
import { getSuwayomiConfig, loginWithSimpleAuth } from '@/lib/suwayomi.client';
import { getConfig } from '@/lib/config';

export const runtime = 'nodejs';

// 国内镜像代理（仅代理 raw.githubusercontent.com 等国外域名）
const DEFAULT_GITHUB_PROXY = 'https://gh-proxy.com/';

function buildGhProxyUrl(upstreamUrl: string, proxyBase: string): string {
  return proxyBase.replace(/\/$/, '') + '/' + upstreamUrl;
}

/**
 * 判断一个 URL 的 host 是否需要走 GitHub 镜像代理
 * 仅对 raw.githubusercontent.com 等国外域名生效
 */
function needsGhProxy(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'raw.githubusercontent.com' || host.endsWith('.github.io');
  } catch {
    return false;
  }
}

function resolveUpstreamUrl(serverBaseUrl: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const target = new URL(pathOrUrl);
    const base = new URL(serverBaseUrl);
    if (target.origin !== base.origin) {
      throw new Error('不允许代理非当前 Suwayomi 服务的地址');
    }
    return target.toString();
  }

  if (!pathOrUrl.startsWith('/')) {
    pathOrUrl = `/${pathOrUrl}`;
  }

  return `${serverBaseUrl}${pathOrUrl}`;
}

export async function GET(request: NextRequest) {
  const username = await getAuthorizedUsername(request);
  if (username instanceof NextResponse) return username;

  try {
    const pathOrUrl = new URL(request.url).searchParams.get('path')?.trim();
    if (!pathOrUrl) {
      return NextResponse.json({ error: '缺少 path 参数' }, { status: 400 });
    }

    const config = await getSuwayomiConfig();
    const upstreamUrl = resolveUpstreamUrl(config.serverBaseUrl, pathOrUrl);

    // GitHub 镜像代理：漫画源图片多托管在 GitHub（如 Cover、Chapter Pages）
    let fetchUrl = upstreamUrl;
    let ghProxyBase = DEFAULT_GITHUB_PROXY;
    try {
      const adminConfig = await getConfig();
      ghProxyBase = adminConfig.SuwayomiConfig?.GhProxyUrl || DEFAULT_GITHUB_PROXY;
    } catch {
      // 配置读取失败时使用默认值
    }
    if (needsGhProxy(upstreamUrl)) {
      fetchUrl = buildGhProxyUrl(upstreamUrl, ghProxyBase);
    }

    const buildHeaders = async (
      forceRelogin: boolean
    ): Promise<HeadersInit | undefined> => {
      if (config.authMode === 'basic_auth') {
        if (!config.username || !config.password) {
          throw new Error('Suwayomi basic_auth 缺少用户名或密码');
        }

        return new Headers({
          Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
        });
      }

      if (config.authMode === 'simple_login') {
        return new Headers({
          Cookie: await loginWithSimpleAuth(config, forceRelogin),
        });
      }

      return undefined;
    };

    let response = await fetch(fetchUrl, {
      headers: await buildHeaders(false),
      cache: 'no-store',
    });

    if (response.status === 401 && config.authMode === 'simple_login') {
      response = await fetch(fetchUrl, {
        headers: await buildHeaders(true),
        cache: 'no-store',
      });
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Suwayomi 图片请求失败: ${response.status}` },
        { status: response.status }
      );
    }

    const headers = new Headers();
    const contentType = response.headers.get('content-type');
    const cacheControl = response.headers.get('cache-control');
    if (contentType) headers.set('content-type', contentType);
    headers.set('cache-control', cacheControl || 'public, max-age=300');

    return new NextResponse(response.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '图片代理失败' },
      { status: 500 }
    );
  }
}
