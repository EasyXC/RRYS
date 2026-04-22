'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AdUnlockModal from '@/components/AdUnlockModal';

/** 检查用户是否已解锁 */
function checkUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('ad_unlock');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (Date.now() < data.expiresAt) return true;
    localStorage.removeItem('ad_unlock');
    return false;
  } catch {
    localStorage.removeItem('ad_unlock');
    return false;
  }
}

/**
 * 广告解锁 Hook
 * - 页面加载时检查解锁状态（24小时有效）
 * - 未解锁用户点击页面任意位置时触发广告弹窗
 * - 解锁成功后记录到 localStorage
 */
export function useAdUnlock() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const sessionTriggered = useRef(false);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // 初始化 + 每分钟检查过期
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMounted(true);
    setIsUnlocked(checkUnlocked());
    const timer = setInterval(() => setIsUnlocked(checkUnlocked()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // 解锁成功回调
  const handleUnlocked = useCallback(() => {
    setIsUnlocked(true);
    setShowModal(false);
    sessionTriggered.current = true;
    setIsUnlocked(checkUnlocked());
  }, []);

  // 触发广告弹窗
  const trigger = useCallback(() => {
    if (typeof window === 'undefined') return;
    const config = (window as any).RUNTIME_CONFIG;
    if (config?.ENABLE_AD_UNLOCK !== true) return;
    if (isUnlocked) return;
    if (sessionTriggered.current) return;
    sessionTriggered.current = true;
    setShowModal(true);
  }, [isUnlocked]);

  // 创建 Portal 挂载点
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!portalRef.current) {
      portalRef.current = document.createElement('div');
      portalRef.current.id = 'ad-unlock-portal';
      document.body.appendChild(portalRef.current);
    }
    return () => {
      if (portalRef.current) {
        document.body.removeChild(portalRef.current);
        portalRef.current = null;
      }
    };
  }, []);

  const modal = mounted && portalRef.current && showModal
    ? createPortal(<AdUnlockModal onUnlocked={handleUnlocked} />, portalRef.current)
    : null;

  return { isUnlocked, trigger, modal };
}
