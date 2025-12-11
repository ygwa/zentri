use crate::models::CardListItem;
use std::collections::HashMap;
use rand::Rng;
use petgraph::graph::{Graph, NodeIndex};
use petgraph::Undirected;

#[derive(serde::Serialize)]
pub struct GraphNode {
    pub id: String,
    pub title: String,           // 卡片标题（用于显示）
    pub card_type: String,       // 卡片类型（用于着色）
    pub x: f32,
    pub y: f32,
    pub neighbors: Vec<String>,
    pub link_count: usize,       // 链接数量（用于节点大小）
}

#[derive(serde::Serialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<(String, String)>,
}

struct NodeState {
    id: String,
    title: String,
    card_type: String,
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
}

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

        node_states.insert(card.id.clone(), NodeState {
            id: card.id.clone(),
            title: card.title.clone(),
            card_type: card.card_type.as_str().to_string(),
            x: rng.gen_range(-100.0..100.0),
            y: rng.gen_range(-100.0..100.0),
            vx: 0.0,
            vy: 0.0,
        });
    }

    for card in &cards {
        if let Some(&source_idx) = node_indices.get(&card.id) {
            for link_text in &card.links {
                // Try to resolve link text to an ID
                // 1. Check if link_text is already an ID (unlikely with path-based IDs but possible)
                // 2. Check if link_text matches a title or alias
                let target_id = if node_indices.contains_key(link_text) {
                    Some(link_text.clone())
                } else {
                    title_to_id.get(link_text).cloned()
                };

                if let Some(tid) = target_id {
                    if let Some(&target_idx) = node_indices.get(&tid) {
                        // Avoid duplicate edges in undirected graph if possible, 
                        // but petgraph allows parallel edges. We check if connected.
                        if graph.find_edge(source_idx, target_idx).is_none() && source_idx != target_idx {
                            graph.add_edge(source_idx, target_idx, ());
                        }
                    }
                }
            }
        }
    }

    // 2. Run Force-Directed Simulation
    let iterations = 100;
    let k = 50.0; // optimal distance
    let repulsion = 5000.0;
    let dt = 0.1;
    let damping = 0.85;

    for _ in 0..iterations {
        // Repulsion (O(N^2) - can be optimized with Barnes-Hut using fdg-sim in future)
        let ids: Vec<String> = node_states.keys().cloned().collect();
        for i in 0..ids.len() {
            for j in (i + 1)..ids.len() {
                let id1 = &ids[i];
                let id2 = &ids[j];

                let (x1, y1) = { let n = &node_states[id1]; (n.x, n.y) };
                let (x2, y2) = { let n = &node_states[id2]; (n.x, n.y) };

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

        // Attraction (Iterate edges from graph)
        for edge in graph.edge_indices() {
            if let Some((source_idx, target_idx)) = graph.edge_endpoints(edge) {
                let source_id = &graph[source_idx];
                let target_id = &graph[target_idx];

                let (x1, y1) = { let n = &node_states[source_id]; (n.x, n.y) };
                let (x2, y2) = { let n = &node_states[target_id]; (n.x, n.y) };

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

        // Update positions
        for node in node_states.values_mut() {
            node.vx *= damping;
            node.vy *= damping;
            node.x += node.vx * dt;
            node.y += node.vy * dt;
        }
    }

    // 3. Export Data
    let mut final_nodes = Vec::new();
    let mut final_links = Vec::new();

    for (id, state) in &node_states {
        let mut neighbors = Vec::new();
        if let Some(&idx) = node_indices.get(id) {
             for neighbor_idx in graph.neighbors(idx) {
                 neighbors.push(graph[neighbor_idx].clone());
             }
        }

        final_nodes.push(GraphNode {
            id: id.clone(),
            title: state.title.clone(),
            card_type: state.card_type.clone(),
            x: state.x,
            y: state.y,
            neighbors: neighbors.clone(),
            link_count: neighbors.len(),
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
    }
}
