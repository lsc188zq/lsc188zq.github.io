---
title: "AT_cf17_final_j Tree MST"
date: 2026-07-05
category: 知识
tags: ["最小生成树","树形DP","DFS及其变种"]
description: "给定一棵 n 个节点的树，现有有一张完全图，两点 x,y 之间的边长为 wx+wy+dis{x,y}，其中 dis 表示树上两点的距离。"
sourcePath: "OI/算法/图论/生成树/AT_cf17_final_j Tree MST.md"
---


## 题目大意

给定一棵 $n$ 个节点的树，现有有一张完全图，两点 $x,y$ 之间的边长为 $w_x+w_y+dis_{x,y}$，其中 $dis$ 表示树上两点的距离。

求完全图的最小生成树。

$n \leq 2 \times 10^5$。

## 题解：
求完全图的最小生成树，有一个算法叫做**Boruvka算法**。
它一般适用于两两边权不同的完全无向图，就是每一轮对于每个连通块选最短的连向其它连通块的边然后把它们连起来。可以证明这个算法的正确性。如果边权存在相同的就可能出现额外连的情况，也就是可能成环之类的，可以自己模拟理解一下。当然也可以加一些判断或者附上第二边权解决。
关于这道题就直接自下而上和自上而下两遍dfs，维护连通块间最小边以及不与最小边连向同一个连通块的次小边（这样可以保证二者一定有其一是连向别的连通块的），然后合并时注意判断一些细节就OK了（若所处连通块是否已经发生合并行为则不连边了，最短边连向本连通块则选择次小边等等）。
代码应该还是好理解的。

```cpp
#include<bits/stdc++.h>
using namespace std;
#define ll long long
#define ull unsigned long long
#define lll __int128_t
#define pb push_back
#define fi first
#define se second
#define mp make_pair 

template<typename T>
void read(T& x);
template<typename T>
void write(T x);
template<typename T>
void write(T x,char c);

const int MAXN=200010;
int n,fa[MAXN],cnt,s1[MAXN],s2[MAXN],f1[MAXN],f2[MAXN],s[MAXN],h[MAXN];
ll ans,w[MAXN],dis[MAXN],v[MAXN],k1[MAXN],k2[MAXN],g[MAXN];
bool ok[MAXN];
vector<pair<int,int>> es[MAXN];
vector<int> son[MAXN];
int find(int x){
    return x==fa[x]?x:(fa[x]=find(fa[x]));
}
void dfs1(int x,int f){
    for (auto e:es[x]){
        if (e.fi==f) continue;
        son[x].pb(e.fi);
        dis[e.fi]=dis[x]+e.se;
        dfs1(e.fi,x);
    }
}
void dfsu(int x){
    s1[x]=x; s2[x]=0;
    for (int e:son[x]){
        dfsu(e);
        if (w[s1[e]]<w[s1[x]]){
            if (find(s1[e])!=find(s1[x])) s2[x]=s1[x];
            s1[x]=s1[e];
        }
        else if (w[s1[e]]<w[s2[x]]&&find(s1[e])!=find(s1[x])){
            s2[x]=s1[e];
        }

        if (w[s2[e]]<w[s1[x]]){
            if (find(s2[e])!=find(s1[x])) s2[x]=s1[x];
            s1[x]=s2[e];
        }
        else if (w[s2[e]]<w[s2[x]]&&find(s2[e])!=find(s1[x])){
            s2[x]=s2[e];
        }
    }
}
void dfsd(int x,int f){
    f1[x]=f1[f]; f2[x]=f2[f];
    k1[x]=k1[f]; k2[x]=k2[f];
    if (k1[x]>w[s1[x]]-2*dis[x]){
        
        if (find(s1[x])!=find(f1[x])){
            f2[x]=f1[x];
            k2[x]=k1[x];
        }
        f1[x]=s1[x];
        k1[x]=w[s1[x]]-2*dis[x];
    }
    else if (k2[x]>w[s1[x]]-2*dis[x]&&find(s1[x])!=find(f1[x])){
        k2[x]=w[s1[x]]-2*dis[x];
        f2[x]=s1[x];
    }

    if (k1[x]>w[s2[x]]-2*dis[x]){
        if (find(s2[x])!=find(f1[x])){
            f2[x]=f1[x];
            k2[x]=k1[x];
        }
        f1[x]=s2[x];
        k1[x]=w[s2[x]]-2*dis[x];
    }
    else if (k2[x]>w[s2[x]]-2*dis[x]&&find(s2[x])!=find(f1[x])){
        k2[x]=w[s2[x]]-2*dis[x];
        f2[x]=s2[x];
    }

    if (find(x)==find(f1[x])){
        s[x]=f2[x];
        v[x]=w[x]+k2[x];
    }
    else{
        s[x]=f1[x];
        v[x]=w[x]+k1[x];
    }
    for (int e:son[x]) dfsd(e,x);
}
int main(){
    read(n);
    for (int i=1;i<=n;i++) fa[i]=i;
    for (int i=1;i<=n;i++) read(w[i]);
    for (int i=1;i<n;i++){
        int u,v,w; read(u); read(v); read(w);
        es[u].pb(mp(v,w)); es[v].pb(mp(u,w));
    }
    dfs1(1,0);
    for (int i=1;i<=n;i++) w[i]+=dis[i];
    w[0]=k1[0]=k2[0]=1e17;
    while (cnt<n-1){
        dfsu(1); dfsd(1,0);
        for (int i=1;i<=n;i++) ok[i]=1,g[i]=1e17;
        for (int i=1;i<=n;i++) {
            ok[find(i)]=0;
            if (g[find(i)]>v[i]){
                g[find(i)]=v[i];
                h[find(i)]=s[i];
            }
        }
        for (int i=1;i<=n;i++){
            if (!ok[find(i)]){
                ans+=g[find(i)];
                
                ok[find(i)]=1;
                fa[find(h[find(i)])]=find(i);
                cnt++;
            }
        }
    }
    cout<<ans;
    return 0;
}

template<typename T>
void read(T& x){
    x=0; bool f=0; char ch=getchar();
    while (ch>'9'||ch<'0') {
        if (ch=='-') f=1;
        ch=getchar();
    }
    while (ch<='9'&&ch>='0') x=x*10+ch-'0',ch=getchar();
    x=f?-x:x;
    return;
}
template<typename T>
void write(T x){
    if (x<0) putchar('-'),x=-x;
    if (x>9) write(x/10);
    putchar(x%10+'0');
    return;
}
template<typename T>
void write(T x,char c){
    write(x);
    putchar(c);
    return;
}
```
