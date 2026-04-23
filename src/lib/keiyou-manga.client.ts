/* eslint-disable @typescript-eslint/no-explicit-any */
import { MangaChapter, MangaDetail, MangaSearchItem, MangaSource } from './manga.types';

/**
 * Keiyoushi/Tachiyomi 扩展仓库格式
 * 仓库 JSON 结构：https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json
 */
export interface KeiyouExtensionSource {
  name: string;
  lang: string;
  id: string;
  baseUrl: string;
}

export interface KeiyouExtension {
  name: string;
  pkg: string;
  apk: string;
  lang: string;
  version: string;
  code: number;
  nsfw: number;
  sources: KeiyouExtensionSource[];
}

export interface KeiyouSourceInfo {
  sourceId: string;        // 内部 ID，格式 "keiyou:{pkg}"
  extensionName: string;   // 扩展名称
  sourceName: string;      // 源名称
  lang: string;
  baseUrl: string;
  nsfw: number;
  version: string;
  pkg: string;
}

interface KeiyouSearchResult {
  id: string;
  title: string;
  cover: string;
  description: string;
  author: string;
  status: string;
}

const DEFAULT_REPO_URL = 'https://gh-proxy.com/https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟缓存

interface CachedRepoData {
  extensions: KeiyouExtension[];
  fetchedAt: number;
}

const repoCache = new Map<string, CachedRepoData>();

// ============ 仓库获取与缓存 ============

async function fetchRepoExtensions(repoUrl: string): Promise<KeiyouExtension[]> {
  const cacheKey = repoUrl;
  const cached = repoCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.extensions;
  }

  try {
    const response = await fetch(repoUrl, {
      headers: { 'User-Agent': 'MoonTVPlus/1.0' },
      next: { revalidate: 1800 }, // Next.js 缓存 30 分钟
    });

    if (!response.ok) {
      throw new Error(`仓库请求失败: ${response.status}`);
    }

    const extensions = (await response.json()) as KeiyouExtension[];
    repoCache.set(cacheKey, { extensions, fetchedAt: Date.now() });
    return extensions;
  } catch (error) {
    // 回退缓存
    if (cached) return cached.extensions;
    throw error;
  }
}

export async function getKeiyouSources(repoUrl: string): Promise<KeiyouSourceInfo[]> {
  const extensions = await fetchRepoExtensions(repoUrl);
  const sources: KeiyouSourceInfo[] = [];

  for (const ext of extensions) {
    for (const src of ext.sources) {
      sources.push({
        sourceId: `keiyou:${ext.pkg}`,
        extensionName: ext.name,
        sourceName: src.name,
        lang: src.lang,
        baseUrl: src.baseUrl,
        nsfw: ext.nsfw,
        version: ext.version,
        pkg: ext.pkg,
      });
    }
  }

  return sources;
}

// ============ Tachiyomi API 适配器 ============

/**
 * 构建 Tachiyomi v1 API URL（适用于大多数现代扩展）
 */
function buildV1ApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '');
  // 某些扩展使用 /api/ 前缀，某些直接用 /
  const apiBase = base.includes('/api/') ? base : `${base}/api/v1`;
  return `${apiBase}${path}`;
}

/**
 * 从 baseUrl 推断 Tachiyomi API 端点
 */
function inferApiBaseUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  // 常见的 Tachiyomi API 路径模式
  if (base.includes('/api/v1')) return base;
  if (base.includes('/api')) return base;
  return `${base}/api/v1`;
}

/**
 * 搜索漫画（v1 API）
 */
async function searchMangaViaV1(sourceBaseUrl: string, query: string): Promise<KeiyouSearchResult[]> {
  const apiBase = inferApiBaseUrl(sourceBaseUrl);
  const searchUrl = `${apiBase}/search?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Tachiyomi/1.0', Accept: 'application/json' },
      next: { revalidate: 600 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    // v1 API 返回格式：{ manga: [...] }
    if (data?.manga && Array.isArray(data.manga)) {
      return data.manga.map((item: any) => ({
        id: String(item.id || ''),
        title: item.title || '未命名漫画',
        cover: item.coverUrl || item.thumbnail_url || item.image || '',
        description: item.description || '',
        author: Array.isArray(item.author) ? item.author.join(', ') : (item.author || ''),
        status: item.status || '',
      }));
    }
  } catch {
    // 静默失败，尝试下一个源
  }

  return [];
}

/**
 * 搜索漫画（v0 API，兼容旧扩展）
 */
async function searchMangaViaV0(sourceBaseUrl: string, query: string): Promise<KeiyouSearchResult[]> {
  const base = sourceBaseUrl.replace(/\/$/, '');
  // v0 API 路径
  const searchUrl = `${base}/search?search=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Tachiyomi/1.0', Accept: 'application/json' },
      next: { revalidate: 600 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: String(item.id || item.slug || ''),
        title: item.title || item.name || '未命名漫画',
        cover: item.cover || item.thumbnail || item.image || '',
        description: item.description || '',
        author: Array.isArray(item.author) ? item.author.join(', ') : (item.author || ''),
        status: item.status || '',
      }));
    }
  } catch {
    // 静默失败
  }

  return [];
}

/**
 * 获取漫画详情
 */
async function getMangaDetailViaApi(sourceBaseUrl: string, mangaId: string): Promise<{
  title: string;
  cover: string;
  description: string;
  author: string;
  status: string;
  artist: string;
  genre: string;
  chapters: any[];
} | null> {
  const apiBase = inferApiBaseUrl(sourceBaseUrl);

  // 尝试 v1
  try {
    const detailUrl = `${apiBase}/manga/${mangaId}`;
    const response = await fetch(detailUrl, {
      headers: { 'User-Agent': 'Tachiyomi/1.0', Accept: 'application/json' },
      next: { revalidate: 600 },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || '未命名漫画',
        cover: data.coverUrl || data.thumbnail_url || data.image || '',
        description: data.description || '',
        author: Array.isArray(data.author) ? data.author.join(', ') : (data.author || ''),
        status: data.status || '',
        artist: Array.isArray(data.artist) ? data.artist.join(', ') : (data.artist || ''),
        genre: Array.isArray(data.genre) ? data.genre.join(', ') : (data.genre || ''),
        chapters: data.chapters || [],
      };
    }
  } catch {
    // 尝试失败
  }

  return null;
}

/**
 * 获取章节分页（v1 API）
 */
async function getChapterPagesViaApi(sourceBaseUrl: string, mangaId: string, chapterId: string): Promise<string[]> {
  const apiBase = inferApiBaseUrl(sourceBaseUrl);
  const pagesUrl = `${apiBase}/chapter/${chapterId}`;

  try {
    const response = await fetch(pagesUrl, {
      headers: { 'User-Agent': 'Tachiyomi/1.0', Accept: 'application/json' },
      next: { revalidate: 300 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (data?.pages && Array.isArray(data.pages)) {
      return data.pages.map((page: any) =>
        typeof page === 'string' ? page : (page?.image || page?.url || '')
      ).filter(Boolean);
    }
    if (Array.isArray(data)) {
      return data.map((page: any) =>
        typeof page === 'string' ? page : (page?.image || page?.url || '')
      ).filter(Boolean);
    }
  } catch {
    // 静默失败
  }

  return [];
}

// ============ 客户端类 ============

export class KeiyouMangaClient {
  private repoUrl: string;

  constructor(repoUrl: string = DEFAULT_REPO_URL) {
    this.repoUrl = repoUrl;
  }

  async getSources(): Promise<MangaSource[]> {
    const sources = await getKeiyouSources(this.repoUrl);
    return sources.map((src) => ({
      id: src.sourceId,
      name: src.sourceName,
      lang: src.lang,
      displayName: `${src.sourceName} (${src.extensionName})`,
    }));
  }

  async searchManga(keyword: string, sourceId?: string): Promise<MangaSearchItem[]> {
    const allSources = await getKeiyouSources(this.repoUrl);

    // 过滤源：支持多源搜索和单源搜索
    const targetSources = sourceId
      ? allSources.filter((s) => s.sourceId === sourceId)
      : allSources.slice(0, 5); // 默认最多搜索5个源

    const results: MangaSearchItem[] = [];
    const seen = new Set<string>();

    // 并行搜索（限制并发数）
    const batchSize = 3;
    for (let i = 0; i < targetSources.length; i += batchSize) {
      const batch = targetSources.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (src) => {
          const v1Results = await searchMangaViaV1(src.baseUrl, keyword);
          if (v1Results.length === 0) {
            return searchMangaViaV0(src.baseUrl, keyword);
          }
          return v1Results;
        })
      );

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const src = batch[j];
        if (result.status === 'fulfilled') {
          for (const manga of result.value) {
            const key = `${src.sourceId}:${manga.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push({
              id: manga.id,
              sourceId: src.sourceId,
              sourceName: src.sourceName,
              title: manga.title,
              cover: manga.cover,
              description: manga.description,
              author: manga.author,
              status: manga.status,
            });
          }
        }
      }
    }

    return results;
  }

  async getMangaDetail(mangaId: string, sourceId: string): Promise<MangaDetail | null> {
    // 解析 sourceId
    if (!sourceId.startsWith('keiyou:')) return null;

    const allSources = await getKeiyouSources(this.repoUrl);
    const source = allSources.find((s) => s.sourceId === sourceId);
    if (!source) return null;

    const detail = await getMangaDetailViaApi(source.baseUrl, mangaId);
    if (!detail) return null;

    const chapters: MangaChapter[] = (detail.chapters || []).map((ch: any, index: number) => ({
      id: String(ch.id || index),
      mangaId: mangaId,
      name: ch.name || `第 ${index + 1} 章`,
      chapterNumber: ch.number ?? ch.chapter ?? index + 1,
      scanlator: ch.scanlator || ch.uploader || '',
      isRead: ch.read ?? false,
      isDownloaded: ch.downloaded ?? false,
      pageCount: ch.pageCount ?? ch.pages?.length,
      uploadDate: ch.uploadDate ?? ch.dateUpload ?? 0,
    }));

    return {
      id: mangaId,
      sourceId: sourceId,
      sourceName: source.sourceName,
      title: detail.title,
      cover: detail.cover,
      description: detail.description,
      author: detail.author,
      artist: detail.artist,
      genre: detail.genre,
      status: detail.status,
      chapters,
    };
  }

  async getChapterPages(chapterId: string, sourceId: string): Promise<string[]> {
    if (!sourceId.startsWith('keiyou:')) return [];

    const allSources = await getKeiyouSources(this.repoUrl);
    const source = allSources.find((s) => s.sourceId === sourceId);
    if (!source) return [];

    // 从 chapterId 中提取 mangaId（格式: mangaId/chapterId 或直接 chapterId）
    const parts = chapterId.split('/');
    const mangaId = parts.length > 1 ? parts[0] : '';
    const actualChapterId = parts.length > 1 ? parts[1] : chapterId;

    return getChapterPagesViaApi(source.baseUrl, mangaId, actualChapterId);
  }
}

// 单例（默认使用 keiyoushi 官方仓库）
export const keiyouMangaClient = new KeiyouMangaClient();