---
title: "P11487 「Cfz Round 5」Gnirts 10"
date: 2026-07-05
category: 知识
tags: ["数学","组合计数"]
description: "题面还是简单一点好。"
sourcePath: "OI/算法/数学/组合计数/P11487 「Cfz Round 5」Gnirts 10.md"
---


### 题目描述

题面还是简单一点好。

- 给定 $n, m$，以及一个长为 $n + m$ 的 $\tt{01}$ 串 $S$。
- 对于 $\tt 01$ 串 $T$，定义 $f(T)$ 为 $S$ 的最长的前缀的长度，使得该前缀是 $T$ 的子序列 $^\dagger$。
- 对于每个 **恰包含 $n$ 个 $\tt 1$ 和 $m$ 个 $\tt 0$ 的** $\tt{01}$ 串 $T$，求 $f(T)$ 的和。答案对 $2933256077^\ddagger$ 取模。

$\dagger$：请注意，子序列可以不连续。换句话说，$a$ 是 $b$ 的子序列，当且仅当在 $b$ 中删去 $\geq 0$ 个字符后，可以得到 $a$。注意，空串总是任何串的子序列。

$\ddagger$：模数为质数。

### 输入格式

第一行包含两个整数 $n, m$。  

第二行包含一个长度为 $n + m$ 的 $\tt 01$ 串 $S$。

### 输出格式

输出一行一个整数，表示答案对 $2933256077$ 取模后的结果。

##### 「数据范围」

对于所有测试数据，保证 $1 \leq n, m \leq 3\times 10^6$。

- Subtask 0（13 points）：$\max(n, m) \leq 5$。
- Subtask 1（13 points）：$\max(n, m) \leq 100$。
- Subtask 2（34 points）：$\max(n, m) \leq 3 \times 10^3$。
- Subtask 3（40 points）：无特殊限制。

## 题解：
### 部分分

暴力枚举一下，可以拿 $13$ 分。

考虑设三个状态统计方案数进行 DP，时空复杂度均为 $\mathcal{O}(n^3)$，可以再拿 $13$ 分，这一档应该还是很好想的吧。
写这一档分对我的帮助很大，对题目原理了解更深，后面也用来对拍差错了。所以比赛时尽量还是考虑先写暴力，对心态也有帮助。

Code：

```cpp
#include<bits/stdc++.h>
using namespace std;
#define ll long long

const int MAXN=210;
const ll mod=2933256077;
int n,m,a[MAXN];
ll dp[MAXN][MAXN][MAXN],ans;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr); cout.tie(nullptr);
    cin>>n>>m;
    for (int i=1;i<=n+m;i++){
        char c; cin>>c;
        a[i]=c-'0';
    }
    dp[0][0][0]=1;
    for (int k=0;k<=n+m;k++){
        for (int i=0;i<=n;i++){
            for (int j=0;j<=m;j++){
                if (!dp[k][i][j]) continue;
                if (a[k+1]) {
                    dp[k+1][i+1][j]=(dp[k+1][i+1][j]+dp[k][i][j])%mod;
                    dp[k][i][j+1]=(dp[k][i][j+1]+dp[k][i][j])%mod;
                }
                else{
                    dp[k+1][i][j+1]=(dp[k+1][i][j+1]+dp[k][i][j])%mod;
                    dp[k][i+1][j]=(dp[k][i+1][j]+dp[k][i][j])%mod;
                }
                if (i==n&&j==m){
                    cout<<k<<" "<<dp[k][n][m]<<'\n';
                }
            }
        }
    }
    for (ll i=1;i<=n+m;i++){
        ans=(ans+dp[i][n][m]*i%mod)%mod;
    }
    cout<<ans<<'\n';
    return 0;
}
```

不会 $\mathcal{O}(n^2)$。
没事直接说正解。

### 正解

首先感觉从优化 DP 的角度已经没什么前途了，至少我盯了半天不会优化。考虑到题目给了两个提示：一个是数据范围上的，$n + m \leq 6 \times10^6$，大概率是要线性做法。另一个是模数为**质数**，这就让我们考虑到了逆元。

我们尝试枚举 $S$ 的前缀，这些前缀的字符（后面称之为**前缀符**）在 $T$ 中的相对位置已经固定。只需要统计在它们之前以及前后两部分再插入一些非前缀符且最后要满足 $T$ 的组成条件的方案数即可。

具体一点来说， 假设有一个前缀符 $1$，那么在上一个前缀符与它之前可以插入那些字符？显然只有 $0$，因为如果有 $1$ 那么就会让那个更提前的 $1$ 成为前缀符。这就形成了一个只能放任意多个 $0$ 的**槽**。前缀符是 $0$ 时同理，注意一下末尾插入的也要考虑，详细内容可以见代码。

然后在依次枚举前缀的过程中，先前的前缀符它们中间要放什么已经确定，然后还知道剩下的 $1$ 和 $0$ 的个数。整理成数学形式，就是当前有 $t_0$ 个 $0$ 要分别插到 $k_0$ 个 $0$ 槽中，有 $t_1$ 个 $1$ 要分别插到 $k_1$ 个 $1$ 槽中，问方案数，这时候我们发现这就是个经典问题了。

把 $n$ 个相同物品分到 $m$ 个不同的组可以用**隔板法**解决，答案为 $\binom{n+m-1}{m-1}$。
可以线性处理阶乘和阶乘的逆元，时间复杂度为 $\mathcal{O}(n)$。
Code：

```cpp
#include<bits/stdc++.h>
using namespace std;
#define ll long long

const int MAXN=6000010;
const ll mod=2933256077;
int n,m,a[MAXN],t1,t0,k1,k0;
ll jc[MAXN],inv[MAXN],inj[MAXN],ans;
ll C(ll n,ll m){
    if (n==m) return 1;
    if (n<0||m<0) return 0;
    ll ans=jc[n]*inj[n-m]%mod*inj[m]%mod;
    return ans;
}
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr); cout.tie(nullptr);
    cin>>n>>m;
    inj[0]=jc[0]=inv[1]=1;
    for (int i=2;i<=n+m;i++) inv[i]=(mod-mod/i)*inv[mod%i]%mod;
    for (int i=1;i<=n+m;i++) inj[i]=inv[i]*inj[i-1]%mod,jc[i]=jc[i-1]*i%mod;
    for (int i=1;i<=n+m;i++){
        char c; cin>>c;
        a[i]=c-'0';
    }
    t0=m; t1=n;
    for (int i=1;i<=n+m;i++){
        if (a[i]) t1--,k0++;
        else t0--,k1++;
        if (t0<0||t1<0) break;
        if (i==n+m){
            ans=(ans+n+m)%mod;
            break;
        }
        ll t;
        if (a[i+1]) t=C(t1+k1-1,k1-1)*C(t0+k0,k0)%mod;
        else t=C(t1+k1,k1)*C(t0+k0-1,k0-1)%mod;
        ans=(ans+i*t%mod)%mod;
    }
    cout<<ans<<'\n';
    return 0;
}

```

