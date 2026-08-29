import type { Category, Snippet, Annotation } from "@/types";

// Mock 分类数据
export const mockCategories: Category[] = [
  {
    id: "cat-solidity",
    name: "Solidity",
    parentId: null,
    sortOrder: 0,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "cat-uniswap",
    name: "Uniswap V3",
    parentId: "cat-solidity",
    sortOrder: 0,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "cat-erc20",
    name: "ERC20 标准",
    parentId: "cat-solidity",
    sortOrder: 1,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "cat-go",
    name: "Go",
    parentId: null,
    sortOrder: 1,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
  {
    id: "cat-typescript",
    name: "TypeScript",
    parentId: null,
    sortOrder: 2,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
  },
];

// Mock 代码片段数据
export const mockSnippets: Snippet[] = [
  {
    id: "snippet-liquidity",
    title: "流动性计算",
    language: "solidity",
    content: `function _modifyPosition(
        ModifyPositionParams memory params
    ) private returns (int256 amount0, int256 amount1) {
        // 通过新增的流动性计算 amount0 和 amount1
        // 参考 UniswapV3 的代码

        // 计算当前价格下，新增流动性需要的 token0 和 token1 的数量
        amount0 = SqrtPriceMath.getAmount0Delta(
            // 当前价格
            sqrtPriceX96,
            // tick 上限对应的价格
            TickMath.getSqrtPriceAtTick(tickUpper),
            // 新增的流动性
            params.liquidityDelta
        );

        amount1 = SqrtPriceMath.getAmount1Delta(
            // tick 下限对应的价格
            TickMath.getSqrtPriceAtTick(tickLower),
            // 当前价格
            sqrtPriceX96,
            // 新增的流动性
            params.liquidityDelta
        );
}`,
    description: "Uniswap V3 中根据流动性计算 token 数量的核心函数",
    tags: ["uniswap", "defi", "liquidity"],
    categoryId: "cat-uniswap",
    createdAt: "2026-08-10T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
  {
    id: "snippet-tick",
    title: "Tick 管理",
    language: "solidity",
    content: `function _updateTick(
        int24 tick,
        int128 liquidityDelta,
        bool upper
    ) private {
        Tick.Info storage info = ticks[tick];
        uint128 liquidityGrossBefore = info.liquidityGross;
        uint128 liquidityGrossAfter = liquidityDelta < 0
            ? liquidityGrossBefore - uint128(-liquidityDelta)
            : liquidityGrossBefore + uint128(liquidityDelta);

        if (liquidityGrossBefore == 0 && liquidityGrossAfter > 0) {
            if (upper) {
                tickBitmap[wordPos(tick)] = setBit(tickBitmap[wordPos(tick)], bitPos(tick));
            } else {
                tickBitmap[wordPos(tick)] = setBit(tickBitmap[wordPos(tick)], bitPos(tick));
            }
        }

        info.liquidityGross = liquidityGrossAfter;
        if (upper) {
            info.liquidityNet = info.liquidityNet - liquidityDelta;
        } else {
            info.liquidityNet = info.liquidityNet + liquidityDelta;
        }
}`,
    description: "Uniswap V3 tick 区间管理和流动性计算",
    tags: ["uniswap", "tick"],
    categoryId: "cat-uniswap",
    createdAt: "2026-08-12T00:00:00Z",
    updatedAt: "2026-08-14T00:00:00Z",
  },
  {
    id: "snippet-http",
    title: "HTTP Server 模板",
    language: "go",
    content: `package main

import (
    "fmt"
    "log"
    "net/http"
)

func main() {
    http.HandleFunc("/", handler)
    fmt.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func handler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, World!")
}`,
    description: "Go 语言 HTTP 服务器最小示例",
    tags: ["http", "server"],
    categoryId: "cat-go",
    createdAt: "2026-08-05T00:00:00Z",
    updatedAt: "2026-08-05T00:00:00Z",
  },
];

// Mock 注释数据
export const mockAnnotations: Annotation[] = [
  {
    id: "annot-1",
    snippetId: "snippet-liquidity",
    title: "函数签名",
    contentMarkdown:
      "`_modifyPosition` 是一个内部函数（`private`），用于计算添加或移除流动性时，token0 和 token1 的数量变化。\n\n**参数：**\n- `params`：`ModifyPositionParams` 结构体，包含流动性变化量和 tick 上下限\n\n**返回值：**\n- `amount0`：token0 的数量变化\n- `amount1`：token1 的数量变化",
    startOffset: 0,
    endOffset: 153,
    color: "indigo",
    sortOrder: 0,
    createdAt: "2026-08-15T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
  {
    id: "annot-2",
    snippetId: "snippet-liquidity",
    title: "amount0 计算逻辑",
    contentMarkdown:
      "调用 `SqrtPriceMath.getAmount0Delta` 计算 token0 的数量变化。\n\n**计算公式：**\n根据当前价格 `sqrtPriceX96` 和上限价格 `tickUpper` 之间的价差，乘以流动性变化量，得到需要的 token0 数量。\n\n> 当价格在区间内时，amount0 对应上限价格到当前价格之间 token0 的需求量。",
    startOffset: 287,
    endOffset: 585,
    color: "amber",
    sortOrder: 1,
    createdAt: "2026-08-15T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
  {
    id: "annot-3",
    snippetId: "snippet-liquidity",
    title: "tickUpper 参数",
    contentMarkdown:
      "流动性区间的**上限 tick 值**。\n\n通过 `TickMath.getSqrtPriceAtTick(tickUpper)` 将 tick 转换为对应的 sqrt 价格（X96 格式）。\n\n在 Uniswap V3 中，tick 是价格的对数表示，每个 tick 对应价格的 0.01% 变化。",
    startOffset: 490,
    endOffset: 499,
    color: "emerald",
    sortOrder: 2,
    createdAt: "2026-08-15T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
];
