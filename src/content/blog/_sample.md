---
title: 渲染管线自检样例
date: 2026-01-01
category: 知识
tags: [测试, 公式]
description: 用于验证公式与代码块渲染的样例文章
---

## 行内公式

行内用美元符号：$O(n \log n)$，以及转义圆括号写法：\(a^2 + b^2 = c^2\)。

## 块级公式

$$
\sum_{i=1}^{n} a_i x^i = 0
$$

方括号写法：

\[
\binom{n}{k} = \frac{n!}{k!(n-k)!}
\]

## 代码块里的危险字符

下面这段代码含 `$` 和 `#`，同步脚本**绝不能**改动它：

```cpp
#include <bits/stdc++.h>
// 价格 $100 和 #define 都不该被当成公式或标题
#define MAXN 100005
int main() {
    long long sum = 0;  // $sum$
    return 0;
}
```

## 标题层级

### 三级标题

#### 四级标题

### 另一个三级标题
