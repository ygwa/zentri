/**
 * useBacklinks Hook
 * 获取指定卡片的反向链接
 */
import { useState, useEffect, useCallback } from "react";
import * as api from "@/services/api";
import type { BacklinkInfo } from "@/services/api/types";

interface UseBacklinksReturn {
  /** 反向链接列表 */
  backlinks: BacklinkInfo[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新反向链接 */
  refresh: () => Promise<void>;
}

/**
 * 获取指定卡片的反向链接
 * @param cardId 卡片 ID
 */
export function useBacklinks(cardId: string | null | undefined): UseBacklinksReturn {
  const [backlinks, setBacklinks] = useState<BacklinkInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBacklinks = useCallback(async () => {
    if (!cardId) {
      setBacklinks([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.graph.getBacklinks(cardId);
      setBacklinks(data);
    } catch (e) {
      console.error("Failed to fetch backlinks:", e);
      setError(e instanceof Error ? e.message : "获取反向链接失败");
      setBacklinks([]);
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  return {
    backlinks,
    isLoading,
    error,
    refresh: fetchBacklinks,
  };
}

/**
 * useCardImportance Hook
 * 获取卡片重要性排名
 */
interface UseCardImportanceReturn {
  rankings: api.CardImportance[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCardImportance(limit?: number): UseCardImportanceReturn {
  const [rankings, setRankings] = useState<api.CardImportance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.graph.getCardImportance(limit);
      setRankings(data);
    } catch (e) {
      console.error("Failed to fetch card importance:", e);
      setError(e instanceof Error ? e.message : "获取重要性排名失败");
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return {
    rankings,
    isLoading,
    error,
    refresh: fetchRankings,
  };
}

/**
 * useKnowledgeClusters Hook
 * 获取知识集群
 */
interface UseKnowledgeClustersReturn {
  clusters: api.KnowledgeCluster[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useKnowledgeClusters(): UseKnowledgeClustersReturn {
  const [clusters, setClusters] = useState<api.KnowledgeCluster[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClusters = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.graph.getKnowledgeClusters();
      setClusters(data);
    } catch (e) {
      console.error("Failed to fetch knowledge clusters:", e);
      setError(e instanceof Error ? e.message : "获取知识集群失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  return {
    clusters,
    isLoading,
    error,
    refresh: fetchClusters,
  };
}

/**
 * useOrphanNodes Hook
 * 获取孤立节点
 */
interface UseOrphanNodesReturn {
  orphanIds: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOrphanNodes(): UseOrphanNodesReturn {
  const [orphanIds, setOrphanIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrphans = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.graph.getOrphanNodes();
      setOrphanIds(data);
    } catch (e) {
      console.error("Failed to fetch orphan nodes:", e);
      setError(e instanceof Error ? e.message : "获取孤立节点失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrphans();
  }, [fetchOrphans]);

  return {
    orphanIds,
    isLoading,
    error,
    refresh: fetchOrphans,
  };
}



