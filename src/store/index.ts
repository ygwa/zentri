import { create } from "zustand";
import type { Card, ViewType, Source, Highlight } from "@/types";

// Mock 数据 - 更多测试数据
const mockCards: Card[] = [
  // 闪念卡片 (fleeting) - 15张
  {
    id: "f1",
    type: "fleeting",
    title: "Rust 所有权的思考",
    content: "今天看书发现，Rust 的所有权其实就像是一种独占式资源管理...",
    tags: ["Rust", "编程"],
    links: ["p1"],
    createdAt: Date.now() - 1000 * 60 * 30,
    updatedAt: Date.now() - 1000 * 60 * 5,
  },
  {
    id: "f2",
    type: "fleeting",
    title: "本周学习回顾",
    content: "这周主要学习了 Tauri 框架和 Rust 的基础语法，感觉 Rust 的学习曲线确实比较陡峭。",
    tags: ["周记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "f3",
    type: "fleeting",
    title: "关于 AI 编程助手的想法",
    content: "AI 编程助手正在改变我们写代码的方式，但核心还是要理解原理。",
    tags: ["AI", "思考"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 1,
  },
  {
    id: "f4",
    type: "fleeting",
    title: "TypeScript 类型体操",
    content: "今天研究了一下 TypeScript 的高级类型，infer 关键字真的很强大。",
    tags: ["TypeScript", "编程"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 4,
  },
  {
    id: "f5",
    type: "fleeting",
    title: "React 19 新特性",
    content: "React 19 引入了 use() hook 和 Actions，看起来很有意思。",
    tags: ["React", "前端"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    updatedAt: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: "f6",
    type: "fleeting",
    title: "Tailwind CSS 最佳实践",
    content: "使用 cn() 函数合并类名，用 CSS 变量管理主题色。",
    tags: ["CSS", "前端"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 12,
    updatedAt: Date.now() - 1000 * 60 * 60 * 10,
  },
  {
    id: "f7",
    type: "fleeting",
    title: "GraphQL vs REST",
    content: "GraphQL 更灵活，但 REST 更简单。选择取决于具体场景。",
    tags: ["API", "后端"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "f8",
    type: "fleeting",
    title: "SQLite 是被低估的数据库",
    content: "对于很多应用来说，SQLite 完全够用，而且零配置。",
    tags: ["数据库", "SQLite"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "f9",
    type: "fleeting",
    title: "关于知识管理的反思",
    content: "笔记不在于多，而在于建立连接。Zettelkasten 方法论的核心就是这个。",
    tags: ["知识管理", "方法论"],
    links: ["pr1"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: "f10",
    type: "fleeting",
    title: "Vim 快捷键记录",
    content: "ciw 改变一个词，dap 删除一个段落，这些组合太强大了。",
    tags: ["工具", "Vim"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
  },
  {
    id: "f11",
    type: "fleeting",
    title: "Docker 网络模式",
    content: "bridge、host、none 三种模式，大多数情况用 bridge 就够了。",
    tags: ["Docker", "运维"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: "f12",
    type: "fleeting",
    title: "WebAssembly 的潜力",
    content: "Wasm 不仅可以在浏览器运行，也可以在服务端运行，潜力巨大。",
    tags: ["WebAssembly", "技术"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6,
  },
  {
    id: "f13",
    type: "fleeting",
    title: "函数式编程思想",
    content: "纯函数、不可变数据、组合优于继承，这些思想在现代前端很常见。",
    tags: ["编程范式", "函数式"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    id: "f14",
    type: "fleeting",
    title: "Git rebase 使用技巧",
    content: "interactive rebase 可以合并、重排、编辑提交，非常强大。",
    tags: ["Git", "工具"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
  },
  {
    id: "f15",
    type: "fleeting",
    title: "性能优化的一般原则",
    content: "先测量，再优化。不要过早优化，但也不要忽视明显的性能问题。",
    tags: ["性能", "最佳实践"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9,
  },

  // 永久卡片 (permanent) - 12张
  {
    id: "p1",
    type: "permanent",
    title: "零成本抽象 (Zero-Cost Abstraction)",
    content: "零成本抽象是 C++ 和 Rust 的核心设计哲学之一。它的含义是：你不需要为你没有使用的特性付出代价，而你使用的特性也不会比手写代码更慢。",
    tags: ["Rust", "性能"],
    links: ["f1", "p2"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "p2",
    type: "permanent",
    title: "所有权 vs 垃圾回收",
    content: "Rust 的所有权系统与传统 GC 的对比：所有权在编译期完成内存安全检查，GC 在运行时管理内存。",
    tags: ["Rust", "内存管理"],
    links: ["p1"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: "p3",
    type: "permanent",
    title: "SOLID 原则详解",
    content: "单一职责、开闭原则、里氏替换、接口隔离、依赖倒置 - 面向对象设计的五大原则。",
    tags: ["设计模式", "OOP"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
  },
  {
    id: "p4",
    type: "permanent",
    title: "CAP 定理",
    content: "分布式系统中，一致性(Consistency)、可用性(Availability)、分区容错(Partition tolerance)三者最多只能同时满足两个。",
    tags: ["分布式", "系统设计"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
  },
  {
    id: "p5",
    type: "permanent",
    title: "事件溯源 (Event Sourcing)",
    content: "不直接存储状态，而是存储导致状态变化的事件序列。可以重建任意时刻的状态。",
    tags: ["架构", "设计模式"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 25,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
  },
  {
    id: "p6",
    type: "permanent",
    title: "React 渲染机制",
    content: "Virtual DOM diff 算法、Fiber 架构、并发模式 - React 如何高效更新 UI。",
    tags: ["React", "前端"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 25,
  },
  {
    id: "p7",
    type: "permanent",
    title: "HTTP/2 与 HTTP/3",
    content: "多路复用、头部压缩、服务器推送 - HTTP/2 的改进。HTTP/3 基于 QUIC 协议进一步优化。",
    tags: ["网络", "协议"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 35,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  },
  {
    id: "p8",
    type: "permanent",
    title: "数据库索引原理",
    content: "B+树索引、哈希索引、全文索引 - 不同类型索引的适用场景和实现原理。",
    tags: ["数据库", "索引"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 35,
  },
  {
    id: "p9",
    type: "permanent",
    title: "微服务架构模式",
    content: "服务发现、负载均衡、熔断器、API 网关 - 微服务架构的核心组件和模式。",
    tags: ["架构", "微服务"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 45,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
  },
  {
    id: "p10",
    type: "permanent",
    title: "OAuth 2.0 授权流程",
    content: "授权码模式、隐式模式、密码模式、客户端模式 - 四种授权方式的适用场景。",
    tags: ["安全", "认证"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 50,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 45,
  },
  {
    id: "p11",
    type: "permanent",
    title: "响应式编程概念",
    content: "Observable、Observer、Subscription - 响应式编程的核心概念和实现。",
    tags: ["编程范式", "响应式"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 55,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 50,
  },
  {
    id: "p12",
    type: "permanent",
    title: "设计系统构建指南",
    content: "原子设计、设计令牌、组件库 - 如何构建可扩展的设计系统。",
    tags: ["设计", "前端"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 55,
  },

  // 文献卡片 (literature) - 10张
  {
    id: "l1",
    type: "literature",
    title: "《Rust 程序设计语言》笔记",
    content: "第四章：理解所有权。所有权是 Rust 最独特的特性，它让 Rust 无需垃圾回收器即可保证内存安全。",
    tags: ["Rust", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
  },
  {
    id: "l2",
    type: "literature",
    title: "《Clean Code》读书笔记",
    content: "有意义的命名、函数要小、注释是代码的失败 - Robert Martin 的编程智慧。",
    tags: ["编程", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
  },
  {
    id: "l3",
    type: "literature",
    title: "《设计模式》GoF 笔记",
    content: "创建型、结构型、行为型 - 23 种经典设计模式的分类和应用场景。",
    tags: ["设计模式", "读书笔记"],
    links: ["p3"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 25,
  },
  {
    id: "l4",
    type: "literature",
    title: "《系统设计面试》笔记",
    content: "扩展性、可用性、一致性 - 分布式系统设计的核心考量点。",
    tags: ["系统设计", "读书笔记"],
    links: ["p4"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 35,
  },
  {
    id: "l5",
    type: "literature",
    title: "《重构》Martin Fowler",
    content: "代码的坏味道、重构手法目录 - 如何改善既有代码的设计。",
    tags: ["重构", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 50,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 45,
  },
  {
    id: "l6",
    type: "literature",
    title: "《深入理解计算机系统》",
    content: "程序是如何在硬件上运行的 - 从汇编到操作系统的全景视角。",
    tags: ["计算机基础", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 55,
  },
  {
    id: "l7",
    type: "literature",
    title: "《算法导论》核心章节",
    content: "排序、图算法、动态规划 - 算法设计与分析的经典教材。",
    tags: ["算法", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 70,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 65,
  },
  {
    id: "l8",
    type: "literature",
    title: "《JavaScript 高级程序设计》",
    content: "原型链、闭包、事件循环 - JavaScript 深入理解。",
    tags: ["JavaScript", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 80,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 75,
  },
  {
    id: "l9",
    type: "literature",
    title: "《凤凰项目》DevOps 小说",
    content: "通过故事讲述 DevOps 转型 - IT 运维与业务的融合之道。",
    tags: ["DevOps", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 90,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 85,
  },
  {
    id: "l10",
    type: "literature",
    title: "《人月神话》经典回顾",
    content: "没有银弹、外科手术队伍 - 软件工程的永恒真理。",
    tags: ["软件工程", "读书笔记"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 100,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 95,
  },

  // 项目卡片 (project) - 8张
  {
    id: "pr1",
    type: "project",
    title: "Zentri 卡片笔记应用",
    content: "一个基于 Tauri + React 的本地优先卡片笔记应用，实现 Zettelkasten 方法论。",
    tags: ["项目", "Tauri"],
    links: ["f1", "p1", "l1"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 1,
  },
  {
    id: "pr2",
    type: "project",
    title: "个人博客重构",
    content: "使用 Next.js 14 + MDX 重构个人博客，支持 SSG 和增量构建。",
    tags: ["项目", "Next.js"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: "pr3",
    type: "project",
    title: "CLI 工具开发",
    content: "用 Rust 开发一个命令行工具，练习 Rust 实战技能。",
    tags: ["项目", "Rust", "CLI"],
    links: ["p1"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
  },
  {
    id: "pr4",
    type: "project",
    title: "开源组件库",
    content: "基于 shadcn/ui 的思路，构建自己的 React 组件库。",
    tags: ["项目", "React", "组件库"],
    links: ["p12"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 25,
  },
  {
    id: "pr5",
    type: "project",
    title: "API Mock 服务",
    content: "快速生成 Mock API 的工具，支持 OpenAPI 规范导入。",
    tags: ["项目", "工具"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 35,
  },
  {
    id: "pr6",
    type: "project",
    title: "VS Code 插件开发",
    content: "开发一个提高编程效率的 VS Code 插件。",
    tags: ["项目", "VS Code"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 50,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 45,
  },
  {
    id: "pr7",
    type: "project",
    title: "自动化测试框架",
    content: "构建端到端测试框架，集成 Playwright 和 CI/CD。",
    tags: ["项目", "测试"],
    links: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 55,
  },
  {
    id: "pr8",
    type: "project",
    title: "知识图谱可视化",
    content: "将笔记之间的关系可视化为知识图谱。",
    tags: ["项目", "可视化"],
    links: ["pr1"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 70,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 65,
  },
];

// Mock 文献源数据
const mockSources: Source[] = [
  {
    id: "s1",
    type: "book",
    title: "Rust 程序设计语言",
    author: "Steve Klabnik, Carol Nichols",
    description: "Rust 官方教程，全面介绍 Rust 语言的核心概念和实践。",
    tags: ["Rust", "编程语言"],
    progress: 65,
    lastReadAt: Date.now() - 1000 * 60 * 60 * 2,
    metadata: { pageCount: 552, publisher: "No Starch Press", publishDate: "2023" },
    noteIds: ["l1"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: "s2",
    type: "book",
    title: "Clean Code",
    author: "Robert C. Martin",
    description: "A Handbook of Agile Software Craftsmanship",
    tags: ["软件工程", "最佳实践"],
    progress: 100,
    lastReadAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    metadata: { pageCount: 464, publisher: "Prentice Hall", publishDate: "2008" },
    noteIds: ["l2"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 60,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
  },
  {
    id: "s3",
    type: "webpage",
    title: "React 19 Release Notes",
    url: "https://react.dev/blog/2024/04/25/react-19",
    description: "React 19 正式发布，带来 Actions、use() hook 等新特性。",
    tags: ["React", "前端"],
    progress: 100,
    lastReadAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    noteIds: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
  {
    id: "s4",
    type: "paper",
    title: "Attention Is All You Need",
    author: "Vaswani et al.",
    url: "https://arxiv.org/abs/1706.03762",
    description: "提出 Transformer 架构的开创性论文。",
    tags: ["AI", "深度学习", "NLP"],
    progress: 45,
    lastReadAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    noteIds: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
  {
    id: "s5",
    type: "video",
    title: "Rust for TypeScript Developers",
    author: "ThePrimeagen",
    url: "https://www.youtube.com/watch?v=...",
    description: "从 TypeScript 开发者视角学习 Rust。",
    tags: ["Rust", "TypeScript", "视频教程"],
    progress: 80,
    lastReadAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    metadata: { duration: 7200 },
    noteIds: [],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 15,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: "s6",
    type: "book",
    title: "设计模式：可复用面向对象软件的基础",
    author: "Gang of Four",
    description: "软件设计模式的经典之作，介绍 23 种设计模式。",
    tags: ["设计模式", "软件工程"],
    progress: 30,
    lastReadAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
    metadata: { pageCount: 395, publisher: "机械工业出版社", publishDate: "2000" },
    noteIds: ["l3"],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 90,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
];

// Mock 高亮数据
const mockHighlights: Highlight[] = [
  {
    id: "h1",
    sourceId: "s1",
    cardId: "l1",
    content: "所有权是 Rust 最独特的特性，它让 Rust 无需垃圾回收器即可保证内存安全。",
    note: "这是 Rust 的核心理念",
    position: { page: 71, chapter: "第四章" },
    color: "yellow",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
  {
    id: "h2",
    sourceId: "s2",
    content: "Clean code is simple and direct. Clean code reads like well-written prose.",
    position: { page: 23 },
    color: "green",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  },
];

interface AppState {
  // 数据
  cards: Card[];
  sources: Source[];
  highlights: Highlight[];
  
  // UI 状态
  currentView: ViewType;
  selectedCardId: string | null;
  searchQuery: string;
  
  // Actions
  setCurrentView: (view: ViewType) => void;
  selectCard: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  
  // Card operations
  createCard: (type: Card["type"], title: string, sourceId?: string) => Card;
  updateCard: (id: string, updates: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  
  // Source operations
  createSource: (source: Omit<Source, "id" | "createdAt" | "updatedAt" | "noteIds">) => Source;
  updateSource: (id: string, updates: Partial<Source>) => void;
  deleteSource: (id: string) => void;
  
  // Highlight operations
  createHighlight: (highlight: Omit<Highlight, "id" | "createdAt">) => Highlight;
  deleteHighlight: (id: string) => void;
  
  // Computed
  filteredCards: () => Card[];
  getCardById: (id: string) => Card | undefined;
  getSourceById: (id: string) => Source | undefined;
  getHighlightsBySource: (sourceId: string) => Highlight[];
  getNotesBySource: (sourceId: string) => Card[];
}

export const useAppStore = create<AppState>((set, get) => ({
  cards: mockCards,
  sources: mockSources,
  highlights: mockHighlights,
  currentView: "all",
  selectedCardId: null,
  searchQuery: "",
  
  setCurrentView: (view) => set({ currentView: view, selectedCardId: null }),
  selectCard: (id) => set({ selectedCardId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  createCard: (type, title, sourceId) => {
    const newCard: Card = {
      id: crypto.randomUUID(),
      type,
      title,
      content: "",
      tags: [],
      links: [],
      sourceId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => {
      // 如果是文献笔记，更新对应 source 的 noteIds
      if (sourceId) {
        return {
          cards: [newCard, ...state.cards],
          sources: state.sources.map((s) =>
            s.id === sourceId ? { ...s, noteIds: [...s.noteIds, newCard.id] } : s
          ),
        };
      }
      return { cards: [newCard, ...state.cards] };
    });
    return newCard;
  },
  
  updateCard: (id, updates) => {
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === id ? { ...card, ...updates, updatedAt: Date.now() } : card
      ),
    }));
  },
  
  deleteCard: (id) => {
    set((state) => ({
      cards: state.cards.filter((card) => card.id !== id),
      selectedCardId: state.selectedCardId === id ? null : state.selectedCardId,
      // 从 sources 的 noteIds 中移除
      sources: state.sources.map((s) => ({
        ...s,
        noteIds: s.noteIds.filter((nid) => nid !== id),
      })),
    }));
  },
  
  // Source operations
  createSource: (sourceData) => {
    const newSource: Source = {
      ...sourceData,
      id: crypto.randomUUID(),
      noteIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ sources: [newSource, ...state.sources] }));
    return newSource;
  },
  
  updateSource: (id, updates) => {
    set((state) => ({
      sources: state.sources.map((source) =>
        source.id === id ? { ...source, ...updates, updatedAt: Date.now() } : source
      ),
    }));
  },
  
  deleteSource: (id) => {
    set((state) => ({
      sources: state.sources.filter((source) => source.id !== id),
      // 删除关联的高亮
      highlights: state.highlights.filter((h) => h.sourceId !== id),
    }));
  },
  
  // Highlight operations
  createHighlight: (highlightData) => {
    const newHighlight: Highlight = {
      ...highlightData,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    set((state) => ({ highlights: [...state.highlights, newHighlight] }));
    return newHighlight;
  },
  
  deleteHighlight: (id) => {
    set((state) => ({
      highlights: state.highlights.filter((h) => h.id !== id),
    }));
  },
  
  filteredCards: () => {
    const { cards, currentView, searchQuery } = get();
    let filtered = cards;
    
    // Filter by view
    if (currentView !== "all") {
      filtered = filtered.filter((card) => card.type === currentView);
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (card) =>
          card.title.toLowerCase().includes(query) ||
          card.content.toLowerCase().includes(query) ||
          card.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    
    // Sort by updated time
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  },
  
  getCardById: (id) => get().cards.find((card) => card.id === id),
  getSourceById: (id) => get().sources.find((source) => source.id === id),
  getHighlightsBySource: (sourceId) => get().highlights.filter((h) => h.sourceId === sourceId),
  getNotesBySource: (sourceId) => {
    const source = get().sources.find((s) => s.id === sourceId);
    if (!source) return [];
    return get().cards.filter((card) => source.noteIds.includes(card.id));
  },
}));

