import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Download, Check, Loader2, Play, Square } from "lucide-react";
import * as api from "@/services/api";
import type { ModelInfo, ServerStatus } from "@/services/api/ai";
import { cn } from "@/lib/utils";

interface ModelManagerProps {
  className?: string;
}

export function ModelManager({ className }: ModelManagerProps) {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(checkServerStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [models, downloaded] = await Promise.all([
        api.ai.listModels(),
        api.ai.listDownloadedModels(),
      ]);
      setAvailableModels(models);
      setDownloadedModels(downloaded);
    } catch (error) {
      console.error("Failed to load models:", error);
    }
    await checkServerStatus();
  };

  const checkServerStatus = async () => {
    try {
      const status = await api.ai.checkStatus();
      setServerStatus(status);
    } catch (error) {
      console.error("Failed to check server status:", error);
    }
  };

  const handleDownload = async (modelId: string) => {
    setDownloading(modelId);
    setDownloadProgress(0);

    try {
      // 注意：实际的进度回调需要在 Rust 端实现事件发射
      // 这里简化处理，只显示下载状态
      await api.ai.downloadModel(modelId);
      await loadData();
    } catch (error) {
      console.error("Download failed:", error);
      alert(`下载失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setDownloading(null);
      setDownloadProgress(0);
    }
  };

  const handleStartServer = async (modelId: string) => {
    setLoading(true);
    try {
      await api.ai.startServer(modelId);
      await checkServerStatus();
    } catch (error) {
      console.error("Failed to start server:", error);
      alert(`启动失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStopServer = async () => {
    setLoading(true);
    try {
      await api.ai.stopServer();
      await checkServerStatus();
    } catch (error) {
      console.error("Failed to stop server:", error);
      alert(`停止失败: ${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const isDownloaded = (modelId: string) => downloadedModels.includes(modelId);
  const isActive = (modelId: string) =>
    serverStatus?.running &&
    serverStatus.model_path?.includes(modelId);

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardHeader>
          <CardTitle>AI 服务器状态</CardTitle>
          <CardDescription>
            {serverStatus?.running
              ? `运行中 - 端口 ${serverStatus.port}`
              : "未运行"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serverStatus?.running && serverStatus.model_path && (
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">当前模型:</span>{" "}
                {serverStatus.model_path.split("/").pop()?.replace(".gguf", "")}
              </p>
              <Button
                onClick={handleStopServer}
                disabled={loading}
                variant="destructive"
                size="sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                停止服务器
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>可用模型</CardTitle>
          <CardDescription>
            选择并下载模型以启用 AI 功能
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availableModels.map((model) => (
              <div
                key={model.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{model.name}</h3>
                      {isDownloaded(model.id) && (
                        <Badge variant="secondary">
                          <Check className="h-3 w-3 mr-1" />
                          已下载
                        </Badge>
                      )}
                      {isActive(model.id) && (
                        <Badge variant="default">运行中</Badge>
                      )}
                    </div>
                    {model.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {model.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      大小: {formatSize(model.size)}
                    </p>
                  </div>
                </div>

                {downloading === model.id && (
                  <div className="space-y-2">
                    <Progress value={downloadProgress} />
                    <p className="text-xs text-muted-foreground">
                      下载中... {downloadProgress}%
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  {!isDownloaded(model.id) ? (
                    <Button
                      onClick={() => handleDownload(model.id)}
                      disabled={downloading !== null}
                      size="sm"
                      variant="outline"
                    >
                      {downloading === model.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          下载中...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          下载
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      {!isActive(model.id) && (
                        <Button
                          onClick={() => handleStartServer(model.id)}
                          disabled={loading || serverStatus?.running === true}
                          size="sm"
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          启动服务器
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




