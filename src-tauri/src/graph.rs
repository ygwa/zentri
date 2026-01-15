//! 知识图谱模块
//! 提供图谱计算、反向链接、PageRank 排序、连通分量分析等功能

use crate::models::CardListItem;
use petgraph::algo::{connected_components, kosaraju_scc};
use petgraph::graph::{DiGraph, Graph, NodeIndex};
use petgraph::visit::EdgeRef;
use petgraph::Direction;
use petgraph::Undirected;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

// ============ 数据结构 ============

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub title: String,
    pub card_type: String,
    pub x: f32,
    pub y: f32,
    pub neighbors: Vec<String>,
    pub link_count: usize,
    /// PageRank 分数 (0-1)
    #[serde(default)]
    pub importance: f32,
    /// 所属连通分量 ID
    #[serde(default)]
    pub cluster_id: usize,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<(String, String)>,
    /// 连通分量数量
    #[serde(default)]
    pub cluster_count: usize,
    /// 孤立节点数量 (无连接)
    #[serde(default)]
    pub orphan_count: usize,
}

/// 反向链接信息
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkInfo {
    pub id: String,
    pub title: String,
    pub card_type: String,
    /// 引用出现的上下文预览
    pub context: Option<String>,
}

/// 卡片重要性排名
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardImportance {
    pub id: String,
    pub title: String,
    pub score: f32,
    pub inbound_links: usize,
    pub outbound_links: usize,
}

/// 连通分量 (知识集群)
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeCluster {
    pub id: usize,
    pub size: usize,
    pub nodes: Vec<String>,
    /// 集群中心节点 (PageRank 最高)
    pub center_node: Option<String>,
}

// ============ 图谱引擎 ============

/// 图谱引擎 - 维护内存中的图结构
pub struct GraphEngine {
    /// Vault 路径
    vault_path: PathBuf,
    /// 有向图 (用于 PageRank 和反链)
    directed_graph: RwLock<DiGraph<String, ()>>,
    /// 节点索引映射
    node_indices: RwLock<HashMap<String, NodeIndex>>,
    /// 标题/别名到 ID 的映射
    title_to_id: RwLock<HashMap<String, String>>,
    /// 卡片元数据缓存
    card_meta: RwLock<HashMap<String, CardMeta>>,
    /// 是否已初始化
    initialized: RwLock<bool>,
}

#[derive(Clone)]
struct CardMeta {
    title: String,
    card_type: String,
    #[allow(dead_code)]
    links: Vec<String>,
    aliases: Vec<String>,
}

impl GraphEngine {
    /// 创建新的图谱引擎
    pub fn new(vault_path: &Path) -> Self {
        Self {
            vault_path: vault_path.to_path_buf(),
            directed_graph: RwLock::new(DiGraph::new()),
            node_indices: RwLock::new(HashMap::new()),
            title_to_id: RwLock::new(HashMap::new()),
            card_meta: RwLock::new(HashMap::new()),
            initialized: RwLock::new(false),
        }
    }

    /// 初始化或重建图谱
    /// 注意：现在需要从外部传入卡片列表（从数据库获取）
    pub fn rebuild_with_cards(&self, cards: Vec<CardListItem>) {
        self.build_from_cards(cards);
    }

    /// 保持向后兼容的 rebuild 方法（已废弃，使用 rebuild_with_cards）
    #[deprecated(note = "使用 rebuild_with_cards 替代")]
    pub fn rebuild(&self) {
        // 空实现，需要调用者使用 rebuild_with_cards
    }

    /// 从卡片列表构建图谱
    fn build_from_cards(&self, cards: Vec<CardListItem>) {
        let mut graph = DiGraph::new();
        let mut indices = HashMap::new();
        let mut title_map = HashMap::new();
        let mut meta_map = HashMap::new();

        // 第一遍：添加所有节点
        for card in &cards {
            let idx = graph.add_node(card.id.clone());
            indices.insert(card.id.clone(), idx);

            // 建立标题/别名映射
            title_map.insert(card.title.clone(), card.id.clone());
            for alias in &card.aliases {
                title_map.insert(alias.clone(), card.id.clone());
            }

            meta_map.insert(
                card.id.clone(),
                CardMeta {
                    title: card.title.clone(),
                    card_type: card.card_type.as_str().to_string(),
                    links: card.links.clone(),
                    aliases: card.aliases.clone(),
                },
            );
        }

        // 第二遍：添加边
        for card in &cards {
            if let Some(&source_idx) = indices.get(&card.id) {
                for link_text in &card.links {
                    // 解析链接目标
                    let target_id = if indices.contains_key(link_text) {
                        Some(link_text.clone())
                    } else {
                        title_map.get(link_text).cloned()
                    };

                    if let Some(tid) = target_id {
                        if let Some(&target_idx) = indices.get(&tid) {
                            if source_idx != target_idx {
                                // 避免重复边
                                if graph.find_edge(source_idx, target_idx).is_none() {
                                    graph.add_edge(source_idx, target_idx, ());
                                }
                            }
                        }
                    }
                }
            }
        }

        // 更新内部状态
        *self
            .directed_graph
            .write()
            .unwrap_or_else(|e| e.into_inner()) = graph;
        *self.node_indices.write().unwrap_or_else(|e| e.into_inner()) = indices;
        *self.title_to_id.write().unwrap_or_else(|e| e.into_inner()) = title_map;
        *self.card_meta.write().unwrap_or_else(|e| e.into_inner()) = meta_map;
        *self.initialized.write().unwrap_or_else(|e| e.into_inner()) = true;
    }

    /// 确保已初始化
    fn ensure_initialized(&self) {
        if !*self.initialized.read().unwrap_or_else(|e| e.into_inner()) {
            self.rebuild();
        }
    }

    /// 获取反向链接 (谁链接到了这个卡片)
    pub fn get_backlinks(&self, card_id: &str) -> Vec<BacklinkInfo> {
        self.ensure_initialized();

        let graph = self
            .directed_graph
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let indices = self.node_indices.read().unwrap_or_else(|e| e.into_inner());
        let meta = self.card_meta.read().unwrap_or_else(|e| e.into_inner());

        let mut backlinks = Vec::new();

        // 获取目标卡片的标题和别名 (用于在源文本中搜索)
        let (target_title, target_aliases) = if let Some(m) = meta.get(card_id) {
            (m.title.clone(), m.aliases.clone())
        } else {
            (String::new(), Vec::new())
        };

        if let Some(&target_idx) = indices.get(card_id) {
            // 遍历所有入边
            for edge in graph.edges_directed(target_idx, Direction::Incoming) {
                let source_id = &graph[edge.source()];
                if let Some(source_meta) = meta.get(source_id) {
                    // 上下文提取已移除（需要从数据库获取，性能影响较大）
                    // 如果需要上下文，可以在调用 get_backlinks 时传入卡片数据
                    let context = None;

                    backlinks.push(BacklinkInfo {
                        id: source_id.clone(),
                        title: source_meta.title.clone(),
                        card_type: source_meta.card_type.clone(),
                        context,
                    });
                }
            }
        }

        backlinks
    }

    /// 计算 PageRank
    pub fn compute_pagerank(&self, damping: f32, iterations: usize) -> HashMap<String, f32> {
        self.ensure_initialized();

        let graph = self
            .directed_graph
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let indices = self.node_indices.read().unwrap_or_else(|e| e.into_inner());

        let n = graph.node_count();
        if n == 0 {
            return HashMap::new();
        }

        let mut ranks: HashMap<NodeIndex, f32> = HashMap::new();
        let initial_rank = 1.0 / n as f32;

        // 初始化
        for idx in graph.node_indices() {
            ranks.insert(idx, initial_rank);
        }

        // 迭代计算
        for _ in 0..iterations {
            let mut new_ranks: HashMap<NodeIndex, f32> = HashMap::new();

            for idx in graph.node_indices() {
                let mut rank_sum = 0.0;

                // 累加所有入边的贡献
                for edge in graph.edges_directed(idx, Direction::Incoming) {
                    let source_idx = edge.source();
                    let source_out_degree = graph
                        .edges_directed(source_idx, Direction::Outgoing)
                        .count();
                    if source_out_degree > 0 {
                        rank_sum += ranks[&source_idx] / source_out_degree as f32;
                    }
                }

                new_ranks.insert(idx, (1.0 - damping) / n as f32 + damping * rank_sum);
            }

            ranks = new_ranks;
        }

        // 转换为 card_id -> score
        let mut result = HashMap::new();
        for (node_id, &idx) in indices.iter() {
            if let Some(&rank) = ranks.get(&idx) {
                result.insert(node_id.clone(), rank);
            }
        }

        result
    }

    /// 获取卡片重要性排名
    pub fn get_importance_ranking(&self, limit: usize) -> Vec<CardImportance> {
        self.ensure_initialized();

        let graph = self
            .directed_graph
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let indices = self.node_indices.read().unwrap_or_else(|e| e.into_inner());
        let meta = self.card_meta.read().unwrap_or_else(|e| e.into_inner());

        let pagerank = self.compute_pagerank(0.85, 20);

        let mut rankings: Vec<CardImportance> = indices
            .iter()
            .filter_map(|(id, &idx)| {
                let score = pagerank.get(id).copied().unwrap_or(0.0);
                let inbound = graph.edges_directed(idx, Direction::Incoming).count();
                let outbound = graph.edges_directed(idx, Direction::Outgoing).count();
                let card_meta = meta.get(id)?;

                Some(CardImportance {
                    id: id.clone(),
                    title: card_meta.title.clone(),
                    score,
                    inbound_links: inbound,
                    outbound_links: outbound,
                })
            })
            .collect();

        rankings.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        rankings.truncate(limit);
        rankings
    }

    /// 获取连通分量 (知识集群)
    pub fn get_clusters(&self) -> Vec<KnowledgeCluster> {
        self.ensure_initialized();

        let graph = self
            .directed_graph
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let _indices = self.node_indices.read().unwrap_or_else(|e| e.into_inner());
        let _meta = self.card_meta.read().unwrap_or_else(|e| e.into_inner());

        // 转换为无向图计算连通分量
        let undirected: Graph<String, (), Undirected> = graph.clone().into_edge_type();
        let _num_components = connected_components(&undirected);

        // 使用 Kosaraju 算法获取强连通分量
        let sccs = kosaraju_scc(&*graph);

        let pagerank = self.compute_pagerank(0.85, 20);

        let mut clusters: Vec<KnowledgeCluster> = sccs
            .into_iter()
            .enumerate()
            .map(|(cluster_id, component)| {
                let nodes: Vec<String> = component.iter().map(|&idx| graph[idx].clone()).collect();

                // 找到集群中心 (PageRank 最高的节点)
                let center = nodes
                    .iter()
                    .max_by(|a, b| {
                        let ra = pagerank.get(*a).unwrap_or(&0.0);
                        let rb = pagerank.get(*b).unwrap_or(&0.0);
                        ra.partial_cmp(rb).unwrap_or(std::cmp::Ordering::Equal)
                    })
                    .cloned();

                KnowledgeCluster {
                    id: cluster_id,
                    size: nodes.len(),
                    nodes,
                    center_node: center,
                }
            })
            .collect();

        // 按大小排序
        clusters.sort_by(|a, b| b.size.cmp(&a.size));
        clusters
    }

    /// 获取孤立节点 (没有任何连接)
    pub fn get_orphan_nodes(&self) -> Vec<String> {
        self.ensure_initialized();

        let graph = self
            .directed_graph
            .read()
            .unwrap_or_else(|e| e.into_inner());
        let indices = self.node_indices.read().unwrap_or_else(|e| e.into_inner());

        indices
            .iter()
            .filter(|(_, &idx)| {
                let in_degree = graph.edges_directed(idx, Direction::Incoming).count();
                let out_degree = graph.edges_directed(idx, Direction::Outgoing).count();
                in_degree == 0 && out_degree == 0
            })
            .map(|(id, _)| id.clone())
            .collect()
    }

    /// 更新单个卡片的图关系
    #[allow(dead_code)]
    pub fn update_card(&self, card_id: &str, links: Vec<String>, title: &str, aliases: &[String]) {
        self.ensure_initialized();

        let mut graph = self
            .directed_graph
            .write()
            .unwrap_or_else(|e| e.into_inner());
        let mut indices = self.node_indices.write().unwrap_or_else(|e| e.into_inner());
        let mut title_map = self.title_to_id.write().unwrap_or_else(|e| e.into_inner());
        let mut meta = self.card_meta.write().unwrap_or_else(|e| e.into_inner());

        // 获取或创建节点
        let source_idx = if let Some(&idx) = indices.get(card_id) {
            // 删除旧的出边
            let edges_to_remove: Vec<_> = graph
                .edges_directed(idx, Direction::Outgoing)
                .map(|e| e.id())
                .collect();
            for edge_id in edges_to_remove {
                graph.remove_edge(edge_id);
            }
            idx
        } else {
            let idx = graph.add_node(card_id.to_string());
            indices.insert(card_id.to_string(), idx);
            idx
        };

        // 更新标题映射
        title_map.insert(title.to_string(), card_id.to_string());
        for alias in aliases {
            title_map.insert(alias.clone(), card_id.to_string());
        }

        // 添加新的出边
        for link_text in &links {
            let target_id = if indices.contains_key(link_text) {
                Some(link_text.clone())
            } else {
                title_map.get(link_text).cloned()
            };

            if let Some(tid) = target_id {
                if let Some(&target_idx) = indices.get(&tid) {
                    if source_idx != target_idx {
                        graph.add_edge(source_idx, target_idx, ());
                    }
                }
            }
        }

        // 更新元数据
        if let Some(m) = meta.get_mut(card_id) {
            m.title = title.to_string();
            m.links = links;
            m.aliases = aliases.to_vec();
        } else {
            meta.insert(
                card_id.to_string(),
                CardMeta {
                    title: title.to_string(),
                    card_type: "fleeting".to_string(),
                    links,
                    aliases: aliases.to_vec(),
                },
            );
        }
    }

    /// 删除卡片
    #[allow(dead_code)]
    pub fn remove_card(&self, card_id: &str) {
        let mut graph = self
            .directed_graph
            .write()
            .unwrap_or_else(|e| e.into_inner());
        let mut indices = self.node_indices.write().unwrap_or_else(|e| e.into_inner());
        let mut meta = self.card_meta.write().unwrap_or_else(|e| e.into_inner());

        if let Some(idx) = indices.remove(card_id) {
            graph.remove_node(idx);
        }
        meta.remove(card_id);
    }
}

// ============ 原有的布局计算函数 (保持兼容) ============

struct NodeState {
    #[allow(dead_code)]
    id: String,
    title: String,
    card_type: String,
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
}

/// 计算图谱布局 (原有函数，保持兼容)
pub fn compute_layout(cards: Vec<CardListItem>) -> GraphData {
    let mut graph: Graph<String, (), Undirected> = Graph::new_undirected();
    let mut node_indices: HashMap<String, NodeIndex> = HashMap::new();
    let mut node_states: HashMap<String, NodeState> = HashMap::new();
    let mut title_to_id: HashMap<String, String> = HashMap::new();
    let mut rng = rand::thread_rng();

    // 1. Build Graph using petgraph
    for card in &cards {
        let idx = graph.add_node(card.id.clone());
        node_indices.insert(card.id.clone(), idx);

        // Build title/alias lookup
        title_to_id.insert(card.title.clone(), card.id.clone());
        for alias in &card.aliases {
            title_to_id.insert(alias.clone(), card.id.clone());
        }

        node_states.insert(
            card.id.clone(),
            NodeState {
                id: card.id.clone(),
                title: card.title.clone(),
                card_type: card.card_type.as_str().to_string(),
                x: rng.gen_range(-100.0..100.0),
                y: rng.gen_range(-100.0..100.0),
                vx: 0.0,
                vy: 0.0,
            },
        );
    }

    for card in &cards {
        if let Some(&source_idx) = node_indices.get(&card.id) {
            for link_text in &card.links {
                let target_id = if node_indices.contains_key(link_text) {
                    Some(link_text.clone())
                } else {
                    title_to_id.get(link_text).cloned()
                };

                if let Some(tid) = target_id {
                    if let Some(&target_idx) = node_indices.get(&tid) {
                        if graph.find_edge(source_idx, target_idx).is_none()
                            && source_idx != target_idx
                        {
                            graph.add_edge(source_idx, target_idx, ());
                        }
                    }
                }
            }
        }
    }

    // 2. 计算 PageRank (使用临时有向图)
    let pagerank = compute_pagerank_for_cards(&cards, &node_indices, &title_to_id);

    // 3. 计算连通分量
    let num_clusters = connected_components(&graph);
    let mut cluster_assignment: HashMap<String, usize> = HashMap::new();

    // 简单的连通分量分配 (使用 BFS)
    let mut visited: HashMap<NodeIndex, usize> = HashMap::new();
    let mut current_cluster = 0;

    for idx in graph.node_indices() {
        if !visited.contains_key(&idx) {
            let mut stack = vec![idx];
            while let Some(node) = stack.pop() {
                if visited.contains_key(&node) {
                    continue;
                }
                visited.insert(node, current_cluster);
                cluster_assignment.insert(graph[node].clone(), current_cluster);
                for neighbor in graph.neighbors(node) {
                    if !visited.contains_key(&neighbor) {
                        stack.push(neighbor);
                    }
                }
            }
            current_cluster += 1;
        }
    }

    // 4. Run Force-Directed Simulation
    let iterations = 100;
    let k = 50.0;
    let repulsion = 5000.0;
    let dt = 0.1;
    let damping = 0.85;

    for _ in 0..iterations {
        let ids: Vec<String> = node_states.keys().cloned().collect();
        for i in 0..ids.len() {
            for j in (i + 1)..ids.len() {
                let id1 = &ids[i];
                let id2 = &ids[j];

                let (x1, y1) = {
                    let n = &node_states[id1];
                    (n.x, n.y)
                };
                let (x2, y2) = {
                    let n = &node_states[id2];
                    (n.x, n.y)
                };

                let dx = x1 - x2;
                let dy = y1 - y2;
                let dist_sq = dx * dx + dy * dy;
                let dist = dist_sq.sqrt().max(0.1);

                let f = repulsion / dist_sq;
                let fx = (dx / dist) * f;
                let fy = (dy / dist) * f;

                if let Some(n1) = node_states.get_mut(id1) {
                    n1.vx += fx;
                    n1.vy += fy;
                }
                if let Some(n2) = node_states.get_mut(id2) {
                    n2.vx -= fx;
                    n2.vy -= fy;
                }
            }
        }

        for edge in graph.edge_indices() {
            if let Some((source_idx, target_idx)) = graph.edge_endpoints(edge) {
                let source_id = &graph[source_idx];
                let target_id = &graph[target_idx];

                let (x1, y1) = {
                    let n = &node_states[source_id];
                    (n.x, n.y)
                };
                let (x2, y2) = {
                    let n = &node_states[target_id];
                    (n.x, n.y)
                };

                let dx = x1 - x2;
                let dy = y1 - y2;
                let dist = (dx * dx + dy * dy).sqrt().max(0.1);

                let f = (dist * dist) / k;
                let fx = (dx / dist) * f;
                let fy = (dy / dist) * f;

                if let Some(n1) = node_states.get_mut(source_id) {
                    n1.vx -= fx;
                    n1.vy -= fy;
                }
                if let Some(n2) = node_states.get_mut(target_id) {
                    n2.vx += fx;
                    n2.vy += fy;
                }
            }
        }

        for node in node_states.values_mut() {
            node.vx *= damping;
            node.vy *= damping;
            node.x += node.vx * dt;
            node.y += node.vy * dt;
        }
    }

    // 5. Export Data
    let mut final_nodes = Vec::new();
    let mut final_links = Vec::new();
    let mut orphan_count = 0;

    for (id, state) in &node_states {
        let mut neighbors = Vec::new();
        if let Some(&idx) = node_indices.get(id) {
            for neighbor_idx in graph.neighbors(idx) {
                neighbors.push(graph[neighbor_idx].clone());
            }
        }

        let importance = pagerank.get(id).copied().unwrap_or(0.0);
        let cluster_id = cluster_assignment.get(id).copied().unwrap_or(0);

        if neighbors.is_empty() {
            orphan_count += 1;
        }

        final_nodes.push(GraphNode {
            id: id.clone(),
            title: state.title.clone(),
            card_type: state.card_type.clone(),
            x: state.x,
            y: state.y,
            neighbors: neighbors.clone(),
            link_count: neighbors.len(),
            importance,
            cluster_id,
        });
    }

    for edge in graph.edge_indices() {
        if let Some((s, t)) = graph.edge_endpoints(edge) {
            final_links.push((graph[s].clone(), graph[t].clone()));
        }
    }

    GraphData {
        nodes: final_nodes,
        links: final_links,
        cluster_count: num_clusters,
        orphan_count,
    }
}

/// 为卡片计算 PageRank (辅助函数)
fn compute_pagerank_for_cards(
    cards: &[CardListItem],
    _node_indices: &HashMap<String, NodeIndex>,
    title_to_id: &HashMap<String, String>,
) -> HashMap<String, f32> {
    // 构建有向图
    let mut digraph: DiGraph<String, ()> = DiGraph::new();
    let mut di_indices: HashMap<String, NodeIndex> = HashMap::new();

    for card in cards {
        let idx = digraph.add_node(card.id.clone());
        di_indices.insert(card.id.clone(), idx);
    }

    for card in cards {
        if let Some(&source_idx) = di_indices.get(&card.id) {
            for link_text in &card.links {
                let target_id = if di_indices.contains_key(link_text) {
                    Some(link_text.clone())
                } else {
                    title_to_id.get(link_text).cloned()
                };

                if let Some(tid) = target_id {
                    if let Some(&target_idx) = di_indices.get(&tid) {
                        if source_idx != target_idx {
                            digraph.add_edge(source_idx, target_idx, ());
                        }
                    }
                }
            }
        }
    }

    // 计算 PageRank
    let n = digraph.node_count();
    if n == 0 {
        return HashMap::new();
    }

    let mut ranks: HashMap<NodeIndex, f32> = HashMap::new();
    let initial_rank = 1.0 / n as f32;
    let damping = 0.85;
    let iterations = 20;

    for idx in digraph.node_indices() {
        ranks.insert(idx, initial_rank);
    }

    for _ in 0..iterations {
        let mut new_ranks: HashMap<NodeIndex, f32> = HashMap::new();

        for idx in digraph.node_indices() {
            let mut rank_sum = 0.0;

            for edge in digraph.edges_directed(idx, Direction::Incoming) {
                let source_idx = edge.source();
                let out_degree = digraph
                    .edges_directed(source_idx, Direction::Outgoing)
                    .count();
                if out_degree > 0 {
                    rank_sum += ranks[&source_idx] / out_degree as f32;
                }
            }

            new_ranks.insert(idx, (1.0 - damping) / n as f32 + damping * rank_sum);
        }

        ranks = new_ranks;
    }

    // 转换结果
    let mut result = HashMap::new();
    for (card_id, &idx) in di_indices.iter() {
        if let Some(&rank) = ranks.get(&idx) {
            result.insert(card_id.clone(), rank);
        }
    }

    result
}
